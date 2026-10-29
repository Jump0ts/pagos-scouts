import type { Evento } from "@prisma/client";
import { Router, type Request } from "express";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { generarToken } from "../../utils/tokens.js";
import { validar } from "../../utils/validar.js";
import { cursoActivo } from "../cursos/cursos.utils.js";
import { estadoDe, importeDe, pagadoPorCargo } from "../eventos/cargos.utils.js";
import { LineaNoValida, prepararLineas, resumenProveedor, totalDe, type Eleccion, type LineaPreparada } from "./pedidos.calculo.js";
import { excelPorPersona, excelProveedor } from "./pedidos.exportar.js";
import { buscarPersona } from "./pedidos.revision.js";
import { aceptarEnvioSchema, anadirLineasSchema, crearPedidoSchema, editarPedidoSchema, exportarPedidoSchema } from "./pedidos.schema.js";
import {
  cargoParaPedido,
  catalogoDe,
  crearLineas,
  enlaceDe,
  formularioAbierto,
  guardarCatalogo,
  noCerrado,
  pedidoDelGrupo,
  recalcularCargo,
} from "./pedidos.utils.js";

export const pedidosRouter = Router();
const gestion = requiereRol("ADMIN", "TESORERIA");

const aFecha = (f: string) => new Date(`${f}T00:00:00.000Z`);
const aTexto = (f: Date) => f.toISOString().slice(0, 10);

// D-66: un scouter ve lo pedido en sus secciones.
const seccionesVisibles = (req: Request) => (req.grupo!.rol === "SCOUTER" ? new Set(req.grupo!.seccionIds) : null);

const conLineasValidas = <T>(preparar: () => T) => {
  try {
    return preparar();
  } catch (e) {
    if (e instanceof LineaNoValida) throw badRequest(e.message, { lineas: e.message });
    throw e;
  }
};

// Lo que se ve de una linea: el articulo y lo elegido, tal como se guardo.
const describir = (articulo: string, elecciones: Eleccion[]) =>
  [articulo, ...elecciones.map((e) => (e.tipo === "TEXTO" ? `${e.opcion} «${e.valor}»` : e.valor))].join(" · ");

pedidosRouter.post(
  "/",
  gestion,
  asyncHandler(async (req, res) => {
    const datos = validar(crearPedidoSchema, req.body);
    const grupoId = req.grupo!.id;
    const curso = await cursoActivo(grupoId);
    if (!curso) throw badRequest("Aún no hay ningún curso: importa el listado o da de alta a algún educando primero");
    const pedido = await prisma.$transaction(async (tx) => {
      const creado = await tx.evento.create({
        data: {
          grupoId,
          cursoId: curso.id,
          nombre: datos.nombre,
          tipo: "PEDIDO",
          fechaInicio: aFecha(datos.fechaInicio),
          fechaFin: aFecha(datos.fechaFin),
          instruccionesPago: datos.instruccionesPago || null,
          enlacePedido: generarToken(),
        },
      });
      await guardarCatalogo(tx, creado.id, datos.articulos);
      return creado;
    });
    res.status(201).json({ pedido: { id: pedido.id } });
  }),
);

pedidosRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    const visibles = seccionesVisibles(req);
    const [catalogo, cargos, pendientes] = await Promise.all([
      catalogoDe(evento.id),
      prisma.cargo.findMany({
        where: { eventoId: evento.id, estado: "ACTIVO", ...(visibles && { seccionId: { in: [...visibles] } }) },
        orderBy: [{ educando: { nombre: "asc" } }, { educando: { apellidos: "asc" } }],
        include: {
          educando: { select: { id: true, nombre: true, apellidos: true } },
          lineas: { orderBy: { creadoEn: "asc" }, include: { articulo: { select: { nombre: true } } } },
        },
      }),
      visibles ? Promise.resolve(null) : prisma.envioPedido.count({ where: { eventoId: evento.id } }),
    ]);
    const pagados = await pagadoPorCargo(cargos.map((c) => c.id));
    const personas = cargos.map((c) => {
      const pagado = pagados.get(c.id) ?? 0;
      return {
        cargoId: c.id,
        educando: c.educando,
        seccionId: c.seccionId,
        importeCentimos: importeDe(c),
        pagadoCentimos: pagado,
        estado: estadoDe(importeDe(c), pagado),
        lineas: c.lineas.map((l) => ({
          id: l.id,
          articulo: l.articulo.nombre,
          elecciones: l.elecciones as Eleccion[],
          importeCentimos: l.importeCentimos,
        })),
      };
    });
    const proveedor = resumenProveedor(personas.flatMap((p) => p.lineas));
    res.json({
      pedido: {
        id: evento.id,
        nombre: evento.nombre,
        fechaInicio: aTexto(evento.fechaInicio),
        fechaFin: aTexto(evento.fechaFin),
        instruccionesPago: evento.instruccionesPago,
        cerrado: evento.cerradoEn !== null,
        formularioAbierto: formularioAbierto(evento),
        // El enlace del formulario solo lo ven quienes lo gestionan.
        ...(visibles ? {} : { enlace: enlaceDe(evento.enlacePedido!), pendientes }),
        articulos: catalogo,
      },
      resumen: {
        debidoCentimos: personas.reduce((n, p) => n + p.importeCentimos, 0),
        pagadoCentimos: personas.reduce((n, p) => n + Math.min(p.pagadoCentimos, p.importeCentimos), 0),
        personas: personas.length,
        unidades: personas.reduce((n, p) => n + p.lineas.length, 0),
      },
      personas,
      proveedor,
    });
  }),
);

pedidosRouter.patch(
  "/:id",
  gestion,
  asyncHandler(async (req, res) => {
    const datos = validar(editarPedidoSchema, req.body);
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    const inicio = datos.fechaInicio ?? aTexto(evento.fechaInicio);
    const fin = datos.fechaFin ?? aTexto(evento.fechaFin);
    if (fin < inicio) throw badRequest("Revisa los datos enviados", { fechaFin: "La fecha de fin no puede ser anterior al inicio" });
    await prisma.$transaction(async (tx) => {
      await tx.evento.update({
        where: { id: evento.id },
        data: {
          nombre: datos.nombre,
          fechaInicio: datos.fechaInicio ? aFecha(datos.fechaInicio) : undefined,
          fechaFin: datos.fechaFin ? aFecha(datos.fechaFin) : undefined,
          instruccionesPago: datos.instruccionesPago === undefined ? undefined : datos.instruccionesPago || null,
        },
      });
      if (datos.articulos) await guardarCatalogo(tx, evento.id, datos.articulos);
    });
    res.json({ pedido: { id: evento.id } });
  }),
);

// D-67: un enlace nuevo deja sin servicio el anterior (por si se ha difundido donde no debia).
pedidosRouter.post(
  "/:id/enlace",
  gestion,
  asyncHandler(async (req, res) => {
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    const token = generarToken();
    await prisma.evento.update({ where: { id: evento.id }, data: { enlacePedido: token } });
    res.json({ enlace: enlaceDe(token) });
  }),
);

// D-68: cerrado, el formulario deja de admitir envios y no se cambian lineas; se sigue cobrando.
pedidosRouter.post(
  "/:id/cerrar",
  gestion,
  asyncHandler(async (req, res) => {
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    if (!evento.cerradoEn) await prisma.evento.update({ where: { id: evento.id }, data: { cerradoEn: new Date() } });
    res.status(204).end();
  }),
);

pedidosRouter.post(
  "/:id/reabrir",
  gestion,
  asyncHandler(async (req, res) => {
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    await prisma.evento.update({ where: { id: evento.id }, data: { cerradoEn: null } });
    res.status(204).end();
  }),
);

// Alta a mano: lo que una familia pide en persona. No se aplica el tope de unidades del formulario.
pedidosRouter.post(
  "/:id/lineas",
  gestion,
  asyncHandler(async (req, res) => {
    const { educandoId, lineas } = validar(anadirLineasSchema, req.body);
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    noCerrado(evento);
    const catalogo = await catalogoDe(evento.id);
    const preparadas = conLineasValidas(() => prepararLineas(catalogo, lineas, { conTope: false }));
    await prisma.$transaction(async (tx) => {
      const cargo = await cargoParaPedido(tx, evento, educandoId);
      await crearLineas(tx, cargo.id, preparadas);
      await recalcularCargo(tx, cargo.id);
    });
    res.status(201).json({ totalCentimos: totalDe(preparadas) });
  }),
);

pedidosRouter.delete(
  "/:id/lineas/:lineaId",
  gestion,
  asyncHandler(async (req, res) => {
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    noCerrado(evento);
    const linea = await prisma.lineaPedido.findFirst({ where: { id: req.params.lineaId, cargo: { eventoId: evento.id } } });
    if (!linea) throw notFound("Línea no encontrada");
    await prisma.$transaction(async (tx) => {
      await tx.lineaPedido.delete({ where: { id: linea.id } });
      await recalcularCargo(tx, linea.cargoId);
    });
    res.status(204).end();
  }),
);

type LineaEnvio = LineaPreparada;

// D-68: lo pendiente de revisar, con el semaforo y quien puede ser. Solo Admin y Tesoreria.
pedidosRouter.get(
  "/:id/envios",
  gestion,
  asyncHandler(async (req, res) => {
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    const [envios, matriculas, conLineas] = await Promise.all([
      prisma.envioPedido.findMany({ where: { eventoId: evento.id }, orderBy: { creadoEn: "asc" } }),
      prisma.matricula.findMany({
        where: { cursoId: evento.cursoId, bajaEn: null, educando: { grupoId: evento.grupoId } },
        select: { seccionId: true, educando: { select: { id: true, nombre: true, apellidos: true } } },
      }),
      prisma.cargo.findMany({ where: { eventoId: evento.id, lineas: { some: {} } }, select: { educandoId: true } }),
    ]);
    const educandos = matriculas.map((m) => ({ educandoId: m.educando.id, nombre: m.educando.nombre, apellidos: m.educando.apellidos, seccionId: m.seccionId }));
    const yaPidieron = new Set(conLineas.map((c) => c.educandoId));
    const busquedas = envios.map((e) => buscarPersona(e, educandos));
    // Posible cambio: la misma persona ya tiene lineas o aparece en otro envio pendiente.
    const reconocidoEn = busquedas.map((b) => (b.semaforo === "RECONOCIDO" ? b.candidatos[0].educandoId : null));
    res.json({
      envios: envios.map((e, i) => {
        const propuesto = reconocidoEn[i];
        return {
          id: e.id,
          creadoEn: e.creadoEn.toISOString(),
          nombre: e.nombre,
          apellidos: e.apellidos,
          seccionId: e.seccionId,
          lineas: (e.lineas as LineaEnvio[]).map((l) => ({ articulo: l.articulo, elecciones: l.elecciones, importeCentimos: l.importeCentimos })),
          totalCentimos: e.totalCentimos,
          semaforo: busquedas[i].semaforo,
          candidatos: busquedas[i].candidatos,
          posibleCambio: propuesto !== null && (yaPidieron.has(propuesto) || reconocidoEn.some((r, j) => j !== i && r === propuesto)),
        };
      }),
    });
  }),
);

const envioDelPedido = async (envioId: string, evento: Evento) => {
  const envio = await prisma.envioPedido.findFirst({ where: { id: envioId, eventoId: evento.id } });
  if (!envio) throw notFound("Este envío ya no está pendiente");
  return envio;
};

// Aceptar: sus lineas pasan al cargo de quien elige Tesoreria (sumandose, o sustituyendo lo que tenia) y el envio se
// borra (D-70). Se cobra lo que vio la familia al enviar, aunque el catalogo haya cambiado despues.
pedidosRouter.post(
  "/:id/envios/:envioId/aceptar",
  gestion,
  asyncHandler(async (req, res) => {
    const { educandoId, reemplazar } = validar(aceptarEnvioSchema, req.body);
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    noCerrado(evento);
    const envio = await envioDelPedido(req.params.envioId, evento);
    const lineas = envio.lineas as LineaEnvio[];
    const articulos = new Set((await prisma.articulo.findMany({ where: { eventoId: evento.id }, select: { id: true } })).map((a) => a.id));
    if (lineas.some((l) => !articulos.has(l.articuloId))) {
      throw conflict("Un artículo de este envío ya no está en el pedido. Apúntalo a mano y rechaza el envío.");
    }
    await prisma.$transaction(async (tx) => {
      const cargo = await cargoParaPedido(tx, evento, educandoId);
      if (reemplazar) await tx.lineaPedido.deleteMany({ where: { cargoId: cargo.id } });
      await crearLineas(tx, cargo.id, lineas);
      await recalcularCargo(tx, cargo.id);
      await tx.envioPedido.delete({ where: { id: envio.id } });
    });
    res.status(204).end();
  }),
);

pedidosRouter.delete(
  "/:id/envios/:envioId",
  gestion,
  asyncHandler(async (req, res) => {
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    const envio = await envioDelPedido(req.params.envioId, evento);
    await prisma.envioPedido.delete({ where: { id: envio.id } });
    res.status(204).end();
  }),
);

// D-66: por persona (lo que se ve, filtrado para un scouter) o para el proveedor.
pedidosRouter.get(
  "/:id/exportar",
  asyncHandler(async (req, res) => {
    const { vista } = validar(exportarPedidoSchema, req.query);
    const evento = await pedidoDelGrupo(req.params.id, req.grupo!.id);
    const visibles = seccionesVisibles(req);
    const cargos = await prisma.cargo.findMany({
      where: { eventoId: evento.id, estado: "ACTIVO", ...(visibles && { seccionId: { in: [...visibles] } }) },
      include: {
        educando: { select: { nombre: true, apellidos: true } },
        seccion: { select: { nombre: true, orden: true } },
        lineas: { orderBy: { creadoEn: "asc" }, include: { articulo: { select: { nombre: true } } } },
      },
    });
    cargos.sort(
      (a, b) =>
        a.seccion.orden - b.seccion.orden ||
        a.educando.nombre.localeCompare(b.educando.nombre, "es") ||
        a.educando.apellidos.localeCompare(b.educando.apellidos, "es"),
    );
    const lineasDe = (c: (typeof cargos)[number]) => c.lineas.map((l) => ({ articulo: l.articulo.nombre, elecciones: l.elecciones as Eleccion[] }));
    let contenido: Buffer;
    if (vista === "proveedor") {
      contenido = excelProveedor({ pedido: evento.nombre, resumen: resumenProveedor(cargos.flatMap(lineasDe)) });
    } else {
      const [curso, pagados] = await Promise.all([
        prisma.curso.findUniqueOrThrow({ where: { id: evento.cursoId }, select: { nombre: true } }),
        pagadoPorCargo(cargos.map((c) => c.id)),
      ]);
      contenido = excelPorPersona({
        pedido: evento.nombre,
        curso: curso.nombre,
        personas: cargos.map((c) => {
          const pagado = Math.min(pagados.get(c.id) ?? 0, importeDe(c));
          return {
            nombre: c.educando.nombre,
            apellidos: c.educando.apellidos,
            seccion: c.seccion.nombre,
            lineas: lineasDe(c).map((l) => describir(l.articulo, l.elecciones)),
            importeCentimos: importeDe(c),
            pagadoCentimos: pagado,
            estado: estadoDe(importeDe(c), pagado),
          };
        }),
      });
    }
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment(`${evento.nombre} - ${vista === "proveedor" ? "proveedor" : "por persona"}.xlsx`)
      .send(contenido);
  }),
);
