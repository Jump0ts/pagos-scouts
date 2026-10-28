import type { Cargo, Evento, PrecioSeccion } from "@prisma/client";
import { Router, type Request } from "express";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { cursoActivo } from "../cursos/cursos.utils.js";
import { comprobarSeccionesDelGrupo } from "../secciones/secciones.utils.js";
import { sincronizarCargos } from "./cargos.sincronizar.js";
import { estadoDe, importeDe as importe, pagadoPorCargo } from "./cargos.utils.js";
import { excelDeEvento } from "./eventos.exportar.js";
import { ajustarCargoSchema, anadirNinosSchema, crearEventoSchema, editarEventoSchema, exportarSchema } from "./eventos.schema.js";

export const eventosRouter = Router();
const gestion = requiereRol("ADMIN", "TESORERIA");

const aFecha = (f: string) => new Date(`${f}T00:00:00.000Z`);
const aTexto = (f: Date) => f.toISOString().slice(0, 10);

// D-38: un scouter solo ve lo de sus secciones.
const seccionesVisibles = (req: Request) => (req.grupo!.rol === "SCOUTER" ? new Set(req.grupo!.seccionIds) : null);

const eventoDelGrupo = async (id: string, grupoId: string) => {
  const evento = await prisma.evento.findFirst({ where: { id, grupoId }, include: { precios: true } });
  if (!evento) throw notFound("Evento no encontrado");
  return evento;
};

// Lo cobrado de un cargo nunca cuenta mas que lo que debe (un sobrante es saldo de la familia, D-5c).
const resumenDe = (cargos: Cargo[], pagados: Map<string, number>) => {
  const activos = cargos.filter((c) => c.estado === "ACTIVO");
  const pagado = (c: Cargo) => pagados.get(c.id) ?? 0;
  return {
    debidoCentimos: activos.reduce((n, c) => n + importe(c), 0),
    pagadoCentimos: activos.reduce((n, c) => n + Math.min(pagado(c), importe(c)), 0),
    ninos: activos.length,
    alDia: activos.filter((c) => ["PAGADO", "EXENTO"].includes(estadoDe(importe(c), pagado(c)))).length,
  };
};

const sinPagos = async (cargoIds: string[], mensaje: string) => {
  if ((await pagadoPorCargo(cargoIds)).size) throw conflict(mensaje);
};

const vistaEvento = (evento: Evento & { precios: PrecioSeccion[] }) => ({
  id: evento.id,
  nombre: evento.nombre,
  tipo: evento.tipo,
  fechaInicio: aTexto(evento.fechaInicio),
  fechaFin: aTexto(evento.fechaFin),
  descuentoHermanos: evento.descuentoHermanos,
  precioSegundoCentimos: evento.precioSegundoCentimos,
  precioTerceroCentimos: evento.precioTerceroCentimos,
  precios: evento.precios.map((p) => ({ seccionId: p.seccionId, importeCentimos: p.importeCentimos })),
});

// Los niños que se pueden apuntar: matriculados (sin baja) en una seccion con precio en el evento.
const comprobarApuntables = async (cursoId: string, grupoId: string, educandoIds: string[], seccionesConPrecio: Set<string>) => {
  const matriculas = await prisma.matricula.findMany({
    where: { cursoId, bajaEn: null, educandoId: { in: educandoIds }, educando: { grupoId } },
    select: { educandoId: true, seccionId: true },
  });
  const validas = matriculas.filter((m) => seccionesConPrecio.has(m.seccionId));
  if (validas.length !== new Set(educandoIds).size) {
    throw badRequest("Algún niño no está en una sección de este evento", { educandoIds: "Niño no válido" });
  }
  return validas;
};

eventosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const grupoId = req.grupo!.id;
    const curso = await cursoActivo(grupoId);
    if (!curso) {
      res.json({ curso: null, eventos: [] });
      return;
    }
    const visibles = seccionesVisibles(req);
    const eventos = await prisma.evento.findMany({
      where: { grupoId, cursoId: curso.id, ...(visibles && { precios: { some: { seccionId: { in: [...visibles] } } } }) },
      orderBy: [{ fechaFin: "asc" }, { nombre: "asc" }],
      include: { precios: true, cargos: true },
    });
    const pagados = await pagadoPorCargo(eventos.flatMap((e) => e.cargos.map((c) => c.id)));
    res.json({
      curso: { id: curso.id, nombre: curso.nombre },
      eventos: eventos.map((e) => ({
        ...vistaEvento(e),
        resumen: resumenDe(visibles ? e.cargos.filter((c) => visibles.has(c.seccionId)) : e.cargos, pagados),
      })),
    });
  }),
);

eventosRouter.post(
  "/",
  gestion,
  asyncHandler(async (req, res) => {
    const datos = validar(crearEventoSchema, req.body);
    const grupoId = req.grupo!.id;
    const curso = await cursoActivo(grupoId);
    if (!curso) throw badRequest("Aún no hay ningún curso: importa el listado o da de alta a algún educando primero");
    await comprobarSeccionesDelGrupo(grupoId, datos.precios.map((p) => p.seccionId));
    const conPrecio = new Set(datos.precios.map((p) => p.seccionId));
    const apuntados = datos.tipo === "CON_APUNTADOS" ? await comprobarApuntables(curso.id, grupoId, datos.apuntados, conPrecio) : [];

    const evento = await prisma.$transaction(async (tx) => {
      const creado = await tx.evento.create({
        data: {
          grupoId,
          cursoId: curso.id,
          nombre: datos.nombre,
          tipo: datos.tipo,
          fechaInicio: aFecha(datos.fechaInicio),
          fechaFin: aFecha(datos.fechaFin),
          descuentoHermanos: datos.descuentoHermanos,
          precioSegundoCentimos: datos.descuentoHermanos ? datos.precioSegundoCentimos : null,
          precioTerceroCentimos: datos.descuentoHermanos ? datos.precioTerceroCentimos : null,
          precios: { create: datos.precios },
          cargos: { create: apuntados.map((m) => ({ educandoId: m.educandoId, seccionId: m.seccionId, importeCalculadoCentimos: 0 })) },
        },
      });
      await sincronizarCargos(tx, grupoId, creado.id, { generarAunqueCerrado: true });
      return creado;
    });
    res.status(201).json({ evento: { id: evento.id } });
  }),
);

// El detalle de un evento tal como lo ve quien pregunta: un scouter, solo sus secciones (D-38).
const detalleDe = async (req: Request) => {
  const evento = await eventoDelGrupo(req.params.id, req.grupo!.id);
  const visibles = seccionesVisibles(req);
  if (visibles && !evento.precios.some((p) => visibles.has(p.seccionId))) throw notFound("Evento no encontrado");

  const cargos = await prisma.cargo.findMany({
    where: { eventoId: evento.id, ...(visibles && { seccionId: { in: [...visibles] } }) },
    orderBy: [{ educando: { nombre: "asc" } }, { educando: { apellidos: "asc" } }],
    include: { educando: { select: { id: true, nombre: true, apellidos: true } } },
  });
  const pagados = await pagadoPorCargo(cargos.map((c) => c.id));
  const activos = cargos
    .filter((c) => c.estado === "ACTIVO")
    .map((c) => {
      const pagado = pagados.get(c.id) ?? 0;
      return { cargo: c, importe: importe(c), pagado, estado: estadoDe(importe(c), pagado) };
    });
  return { evento, esScouter: Boolean(visibles), resumen: resumenDe(cargos, pagados), excluidos: cargos.filter((c) => c.estado === "EXCLUIDO").length, activos };
};

eventosRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { evento, esScouter, resumen, excluidos, activos } = await detalleDe(req);
    res.json({
      evento: vistaEvento(evento),
      resumen,
      excluidos,
      cargos: activos.map(({ cargo: c, importe: debido, pagado, estado }) => ({
        id: c.id,
        educando: c.educando,
        seccionId: c.seccionId,
        importeCentimos: debido,
        importeCalculadoCentimos: c.importeCalculadoCentimos,
        ajustado: c.importeAjustadoCentimos !== null,
        // D-35: el motivo solo para Admin y Tesoreria.
        ...(esScouter ? {} : { motivoAjuste: c.motivoAjuste }),
        posicionHermano: c.posicionHermano,
        pagadoCentimos: pagado,
        estado,
      })),
    });
  }),
);

// D-53, D-54 y D-55: el Excel con lo que se ve (filtros de estado y seccion), sin el motivo de los ajustes.
eventosRouter.get(
  "/:id/exportar",
  asyncHandler(async (req, res) => {
    const filtros = validar(exportarSchema, req.query);
    const { evento, activos } = await detalleDe(req);
    const [curso, secciones] = await Promise.all([
      prisma.curso.findUniqueOrThrow({ where: { id: evento.cursoId }, select: { nombre: true } }),
      prisma.seccion.findMany({ where: { id: { in: evento.precios.map((p) => p.seccionId) } }, orderBy: { orden: "asc" } }),
    ]);
    const orden = new Map(secciones.map((s, i) => [s.id, i]));
    const filas = activos
      .filter((f) => (!filtros.estado || f.estado === filtros.estado) && (!filtros.seccionId || f.cargo.seccionId === filtros.seccionId))
      .sort((a, b) => (orden.get(a.cargo.seccionId) ?? 0) - (orden.get(b.cargo.seccionId) ?? 0))
      .map((f) => ({
        nombre: f.cargo.educando.nombre,
        apellidos: f.cargo.educando.apellidos,
        seccion: secciones.find((s) => s.id === f.cargo.seccionId)?.nombre ?? "",
        importeCentimos: f.importe,
        pagadoCentimos: Math.min(f.pagado, f.importe),
        estado: f.estado,
      }));
    const seccion = secciones.find((s) => s.id === filtros.seccionId)?.nombre;
    const contenido = excelDeEvento({ evento: evento.nombre, curso: curso.nombre, seccion, estado: filtros.estado, filas });
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment(`${[evento.nombre, seccion].filter(Boolean).join(" - ")}.xlsx`)
      .send(contenido);
  }),
);

eventosRouter.patch(
  "/:id",
  gestion,
  asyncHandler(async (req, res) => {
    const datos = validar(editarEventoSchema, req.body);
    const grupoId = req.grupo!.id;
    const evento = await eventoDelGrupo(req.params.id, grupoId);
    const inicio = datos.fechaInicio ?? aTexto(evento.fechaInicio);
    const fin = datos.fechaFin ?? aTexto(evento.fechaFin);
    if (fin < inicio) throw badRequest("Revisa los datos enviados", { fechaFin: "La fecha de fin no puede ser anterior al inicio" });
    if (datos.precios) await comprobarSeccionesDelGrupo(grupoId, datos.precios.map((p) => p.seccionId));
    const descuento = datos.descuentoHermanos ?? evento.descuentoHermanos;
    const segundo = datos.precioSegundoCentimos !== undefined ? datos.precioSegundoCentimos : evento.precioSegundoCentimos;
    if (descuento && segundo === null) throw badRequest("Revisa los datos enviados", { precioSegundoCentimos: "Indica el precio del 2º hermano" });

    const resumen = await prisma.$transaction(async (tx) => {
      await tx.evento.update({
        where: { id: evento.id },
        data: {
          nombre: datos.nombre,
          fechaInicio: datos.fechaInicio ? aFecha(datos.fechaInicio) : undefined,
          fechaFin: datos.fechaFin ? aFecha(datos.fechaFin) : undefined,
          descuentoHermanos: descuento,
          precioSegundoCentimos: descuento ? segundo : null,
          precioTerceroCentimos: descuento
            ? datos.precioTerceroCentimos !== undefined ? datos.precioTerceroCentimos : evento.precioTerceroCentimos
            : null,
          ...(datos.precios && { precios: { deleteMany: {}, create: datos.precios } }),
        },
      });
      return sincronizarCargos(tx, grupoId, evento.id, { generarAunqueCerrado: Boolean(datos.precios) });
    });
    // D-37: cuantos cargos se han recalculado y cuantos se dejan como estaban por tener un ajuste a mano.
    res.json({ evento: { id: evento.id }, recalculados: resumen.recalculados, sinCambiar: resumen.ajustados });
  }),
);

// Un evento con pagos no se borra: antes hay que deshacer esos pagos.
eventosRouter.delete(
  "/:id",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const evento = await eventoDelGrupo(req.params.id, req.grupo!.id);
    const cargos = await prisma.cargo.findMany({ where: { eventoId: evento.id }, select: { id: true } });
    await sinPagos(cargos.map((c) => c.id), "Este evento tiene pagos registrados. Deshazlos en Movimientos antes de borrarlo.");
    await prisma.evento.delete({ where: { id: evento.id } });
    res.status(204).end();
  }),
);

// Apuntar niños (eventos con apuntados) o volver a añadir a alguien que se quito a mano.
eventosRouter.post(
  "/:id/ninos",
  gestion,
  asyncHandler(async (req, res) => {
    const { educandoIds } = validar(anadirNinosSchema, req.body);
    const grupoId = req.grupo!.id;
    const evento = await eventoDelGrupo(req.params.id, grupoId);
    const validas = await comprobarApuntables(evento.cursoId, grupoId, educandoIds, new Set(evento.precios.map((p) => p.seccionId)));
    await prisma.$transaction(async (tx) => {
      for (const m of validas) {
        await tx.cargo.upsert({
          where: { eventoId_educandoId: { eventoId: evento.id, educandoId: m.educandoId } },
          create: { eventoId: evento.id, educandoId: m.educandoId, seccionId: m.seccionId, importeCalculadoCentimos: 0 },
          update: { estado: "ACTIVO", seccionId: m.seccionId },
        });
      }
      await sincronizarCargos(tx, grupoId, evento.id);
    });
    res.status(204).end();
  }),
);

const cargoDelEvento = async (cargoId: string, eventoId: string) => {
  const cargo = await prisma.cargo.findFirst({ where: { id: cargoId, eventoId } });
  if (!cargo) throw notFound("Cargo no encontrado");
  return cargo;
};

// D-56: que pagos cubren el cargo de un niño. Solo Admin y Tesoreria.
eventosRouter.get(
  "/:id/cargos/:cargoId/pagos",
  gestion,
  asyncHandler(async (req, res) => {
    const evento = await eventoDelGrupo(req.params.id, req.grupo!.id);
    const cargo = await cargoDelEvento(req.params.cargoId, evento.id);
    const asignaciones = await prisma.asignacion.findMany({
      where: { cargoId: cargo.id },
      include: { movimiento: { include: { cruzadoDesde: { select: { origen: true, medio: true } } } } },
      orderBy: [{ movimiento: { fecha: "asc" } }, { movimiento: { creadoEn: "asc" } }],
    });
    res.json({
      pagos: asignaciones.map(({ movimiento: m, importeCentimos }) => ({
        movimientoId: m.id,
        origen: m.origen,
        fecha: m.fecha ? aTexto(m.fecha) : null,
        concepto: m.concepto,
        medio: m.medio,
        importeCentimos,
        // D-51: un pago del banco que es el mismo dinero que uno apuntado a mano o marcado en el listado.
        cruce: m.cruzadoDesde,
      })),
    });
  }),
);

// D-35: importe ajustado a mano (null = volver al calculado) con su motivo.
eventosRouter.patch(
  "/:id/cargos/:cargoId",
  gestion,
  asyncHandler(async (req, res) => {
    const { importeAjustadoCentimos, motivo } = validar(ajustarCargoSchema, req.body);
    const evento = await eventoDelGrupo(req.params.id, req.grupo!.id);
    const cargo = await cargoDelEvento(req.params.cargoId, evento.id);
    const pagado = (await pagadoPorCargo([cargo.id])).get(cargo.id) ?? 0;
    if (importeAjustadoCentimos !== null && importeAjustadoCentimos < pagado) {
      throw badRequest("Revisa los datos enviados", { importeAjustadoCentimos: "No puede ser menos de lo que ya ha pagado" });
    }
    await prisma.cargo.update({
      where: { id: cargo.id },
      data: {
        importeAjustadoCentimos,
        motivoAjuste: importeAjustadoCentimos === null ? null : (motivo ?? null) || null,
      },
    });
    res.status(204).end();
  }),
);

// Quitar a un niño del evento: no se le vuelve a crear el cargo solo, y sus hermanos se recalculan.
eventosRouter.delete(
  "/:id/cargos/:cargoId",
  gestion,
  asyncHandler(async (req, res) => {
    const grupoId = req.grupo!.id;
    const evento = await eventoDelGrupo(req.params.id, grupoId);
    const cargo = await cargoDelEvento(req.params.cargoId, evento.id);
    await sinPagos([cargo.id], "Este niño ya ha pagado algo de este evento. Deshaz ese pago en Movimientos antes de quitarlo.");
    await prisma.$transaction(async (tx) => {
      await tx.cargo.update({ where: { id: cargo.id }, data: { estado: "EXCLUIDO" } });
      await sincronizarCargos(tx, grupoId, evento.id);
    });
    res.status(204).end();
  }),
);
