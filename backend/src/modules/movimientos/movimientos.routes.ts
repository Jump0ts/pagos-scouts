import type { Prisma } from "@prisma/client";
import express, { Router } from "express";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { importeDe } from "../eventos/cargos.utils.js";
import { leerMovimientosBanco } from "./banco.parser.js";
import { clavePagador } from "./clasificacion.js";
import { importarMovimientos, reintentarDudas } from "./movimientos.importar.js";
import { cruzarSchema, filtroSchema, otroIngresoSchema, pagoManualSchema, resolverSchema } from "./movimientos.schema.js";
import type { Apuntado, MovimientoVista } from "./movimientos.types.js";
import { comprobarReparto } from "./reparto.js";

// D-16, D-41: los movimientos del banco solo los ven Admin y Tesoreria.
export const movimientosRouter = Router();
movimientosRouter.use(requiereRol("ADMIN", "TESORERIA"));

const MAX_LISTA = 300;

const ficheroDe = (body: unknown) => {
  if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest("Sube un fichero");
  return leerMovimientosBanco(body);
};
const recibirFichero = express.raw({ type: "application/octet-stream", limit: "5mb" });
const aTexto = (f: Date | null) => f?.toISOString().slice(0, 10) ?? null;

const CAMPOS_APUNTADO = { id: true, origen: true, fecha: true, concepto: true, medio: true, importeCentimos: true } as const;
const vistaApuntado = (a: Prisma.MovimientoGetPayload<{ select: typeof CAMPOS_APUNTADO }>): Apuntado => ({ ...a, fecha: aTexto(a.fecha) });

const INCLUIR = {
  familia: { select: { id: true, nombre: true } },
  clasificadoPor: { select: { nombre: true } },
  cruzadoDesde: { select: CAMPOS_APUNTADO },
  asignaciones: {
    include: { cargo: { select: { evento: { select: { nombre: true } }, educando: { select: { nombre: true } } } } },
  },
} satisfies Prisma.MovimientoInclude;
type MovimientoCompleto = Prisma.MovimientoGetPayload<{ include: typeof INCLUIR }>;

// Las vistas de varios movimientos, con los cargos sugeridos de las dudas y lo que les falta por pagar.
const vistas = async (grupoId: string, movimientos: MovimientoCompleto[]): Promise<MovimientoVista[]> => {
  const sugeridos = await prisma.cargo.findMany({
    where: { id: { in: movimientos.flatMap((m) => m.cargosSugeridos) }, estado: "ACTIVO", evento: { grupoId } },
    select: {
      id: true,
      importeCalculadoCentimos: true,
      importeAjustadoCentimos: true,
      evento: { select: { nombre: true } },
      educando: { select: { nombre: true } },
      asignaciones: { select: { importeCentimos: true } },
    },
  });
  const sugeridoPorId = new Map(sugeridos.map((c) => [c.id, c]));

  return movimientos.map((m) => {
    const asignado = m.asignaciones.reduce((n, a) => n + a.importeCentimos, 0);
    return {
      id: m.id,
      origen: m.origen,
      fecha: aTexto(m.fecha),
      concepto: m.concepto,
      importeCentimos: m.importeCentimos,
      estado: m.estado,
      motivo: m.motivoDuda,
      medio: m.medio,
      nota: m.nota,
      familia: m.familia,
      cargos: m.asignaciones.length
        ? m.asignaciones.map((a) => ({
            cargoId: a.cargoId,
            evento: a.cargo.evento.nombre,
            educando: a.cargo.educando.nombre,
            importeCentimos: a.importeCentimos,
          }))
        : m.cargosSugeridos.flatMap((id) => {
            const c = sugeridoPorId.get(id);
            if (!c) return [];
            const pendiente = importeDe(c) - c.asignaciones.reduce((n, a) => n + a.importeCentimos, 0);
            return pendiente > 0 ? [{ cargoId: id, evento: c.evento.nombre, educando: c.educando.nombre, importeCentimos: pendiente }] : [];
          }),
      sobranteCentimos: m.estado === "CLASIFICADO" && m.familiaId ? m.importeCentimos - asignado : 0,
      cruce: m.cruzadoDesde ? vistaApuntado(m.cruzadoDesde) : null,
      clasificadoPor: m.clasificadoPor?.nombre ?? null,
      clasificadoEn: m.clasificadoEn?.toISOString() ?? null,
    };
  });
};

const movimientoDelGrupo = async (id: string, grupoId: string) => {
  const movimiento = await prisma.movimiento.findFirst({ where: { id, grupoId }, include: INCLUIR });
  if (!movimiento) throw notFound("Movimiento no encontrado");
  return movimiento;
};

const dudaDelGrupo = async (id: string, grupoId: string) => {
  const movimiento = await movimientoDelGrupo(id, grupoId);
  if (movimiento.estado !== "DUDA") throw conflict("Este movimiento ya no está en Dudas");
  return movimiento;
};

movimientosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { estado } = validar(filtroSchema, req.query);
    const grupoId = req.grupo!.id;
    const [contadores, movimientos] = await Promise.all([
      prisma.movimiento.groupBy({ by: ["estado"], where: { grupoId }, _count: true }),
      prisma.movimiento.findMany({
        where: { grupoId, estado },
        orderBy: [{ fecha: { sort: "desc", nulls: "last" } }, { numeroBanco: "desc" }, { creadoEn: "desc" }],
        take: MAX_LISTA,
        include: INCLUIR,
      }),
    ]);
    const cuenta = (e: string) => contadores.find((c) => c.estado === e)?._count ?? 0;
    res.json({
      contadores: { dudas: cuenta("DUDA"), clasificados: cuenta("CLASIFICADO"), otros: cuenta("OTRO_INGRESO") },
      movimientos: await vistas(grupoId, movimientos),
    });
  }),
);

// D-41, paso 1: se sube el Excel tal cual y se devuelve lo que pasaria, sin guardar nada. El fichero no se guarda.
movimientosRouter.post(
  "/importar/analizar",
  recibirFichero,
  asyncHandler(async (req, res) => {
    const leido = ficheroDe(req.body);
    res.json(await importarMovimientos(prisma, req.grupo!.id, leido, null));
  }),
);

// Paso 2: se vuelve a subir el mismo Excel y se guarda todo o nada. Lo ya importado se salta (D-45).
movimientosRouter.post(
  "/importar/confirmar",
  recibirFichero,
  asyncHandler(async (req, res) => {
    const leido = ficheroDe(req.body);
    const grupoId = req.grupo!.id;
    const usuarioId = req.sesion!.usuario.id;
    const resumen = await prisma.$transaction((tx) => importarMovimientos(tx, grupoId, leido, { usuarioId }), {
      timeout: 30_000,
      isolationLevel: "Serializable",
    });
    res.status(201).json(resumen);
  }),
);

// D-46: pago apuntado a mano, ya repartido entre las deudas de una familia.
movimientosRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const datos = validar(pagoManualSchema, req.body);
    const grupoId = req.grupo!.id;
    const usuarioId = req.sesion!.usuario.id;
    const movimiento = await prisma.$transaction(async (tx) => {
      await comprobarReparto(tx, grupoId, datos.familiaId, datos.asignaciones, datos.importeCentimos);
      return tx.movimiento.create({
        data: {
          grupoId,
          origen: "MANUAL",
          fecha: new Date(`${datos.fecha}T00:00:00.000Z`),
          concepto: datos.concepto,
          importeCentimos: datos.importeCentimos,
          medio: datos.medio,
          estado: "CLASIFICADO",
          familiaId: datos.familiaId,
          clasificadoPorId: usuarioId,
          clasificadoEn: new Date(),
          importadoPorId: usuarioId,
          asignaciones: { create: datos.asignaciones },
        },
      });
    });
    res.status(201).json({ movimiento: { id: movimiento.id } });
  }),
);

// Una duda con todo lo necesario para resolverla: si su pagador ya se conoce y con que pagos apuntados se puede
// cruzar (D-51: misma familia, mismo importe, sin cruzar todavia).
movimientosRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const grupoId = req.grupo!.id;
    const movimiento = await movimientoDelGrupo(req.params.id, grupoId);
    const [vista] = await vistas(grupoId, [movimiento]);
    const [pagador, candidatos] = await Promise.all([
      prisma.pagador.findUnique({ where: { grupoId_clave: { grupoId, clave: clavePagador(movimiento.concepto) } }, select: { familiaId: true } }),
      movimiento.estado === "DUDA" && movimiento.origen === "BANCO" && movimiento.familiaId
        ? prisma.movimiento.findMany({
            where: {
              grupoId,
              familiaId: movimiento.familiaId,
              origen: { in: ["MANUAL", "LISTADO"] },
              estado: "CLASIFICADO",
              cruzadoConId: null,
              importeCentimos: movimiento.importeCentimos,
            },
            orderBy: { creadoEn: "asc" },
            select: CAMPOS_APUNTADO,
          })
        : [],
    ]);
    res.json({ movimiento: vista, pagadorConocido: pagador, candidatosCruce: candidatos.map(vistaApuntado) });
  }),
);

// D-5: resolver una duda repartiendola entre deudas de una familia; lo que sobre es saldo (D-48). Con
// recordarPagador se aprende el nombre para esa familia (D-1) y se reintentan sus otras dudas (D-50).
movimientosRouter.post(
  "/:id/resolver",
  asyncHandler(async (req, res) => {
    const datos = validar(resolverSchema, req.body);
    const grupoId = req.grupo!.id;
    const duda = await dudaDelGrupo(req.params.id, grupoId);
    const reintentadas = await prisma.$transaction(
      async (tx) => {
        await comprobarReparto(tx, grupoId, datos.familiaId, datos.asignaciones, duda.importeCentimos);
        await tx.movimiento.update({
          where: { id: duda.id, estado: "DUDA" },
          data: {
            estado: "CLASIFICADO",
            motivoDuda: null,
            familiaId: datos.familiaId,
            cargosSugeridos: [],
            clasificadoPorId: req.sesion!.usuario.id,
            clasificadoEn: new Date(),
            asignaciones: { create: datos.asignaciones },
          },
        });
        if (!datos.recordarPagador) return 0;
        const clave = clavePagador(duda.concepto);
        if (!clave) return 0;
        await tx.pagador.upsert({
          where: { grupoId_clave: { grupoId, clave } },
          create: { grupoId, familiaId: datos.familiaId, clave, nombre: duda.concepto },
          update: { familiaId: datos.familiaId, nombre: duda.concepto },
        });
        return reintentarDudas(tx, grupoId, clave);
      },
      { timeout: 30_000 },
    );
    res.json({ reintentadas });
  }),
);

// D-49: no es un pago de ninguna familia.
movimientosRouter.post(
  "/:id/otro-ingreso",
  asyncHandler(async (req, res) => {
    const { nota } = validar(otroIngresoSchema, req.body);
    const duda = await dudaDelGrupo(req.params.id, req.grupo!.id);
    await prisma.movimiento.update({
      where: { id: duda.id, estado: "DUDA" },
      data: {
        estado: "OTRO_INGRESO",
        motivoDuda: null,
        nota,
        familiaId: null,
        cargosSugeridos: [],
        clasificadoPorId: req.sesion!.usuario.id,
        clasificadoEn: new Date(),
      },
    });
    res.status(204).end();
  }),
);

// D-51: el ingreso del banco es el mismo dinero que un pago apuntado a mano o una marca del listado. El del banco
// se queda con su reparto y el apuntado queda ligado a el.
movimientosRouter.post(
  "/:id/cruzar",
  asyncHandler(async (req, res) => {
    const { movimientoId } = validar(cruzarSchema, req.body);
    const grupoId = req.grupo!.id;
    const duda = await dudaDelGrupo(req.params.id, grupoId);
    if (duda.origen !== "BANCO") throw conflict("Solo se cruzan ingresos del banco");
    const apuntado = await prisma.movimiento.findFirst({
      where: { id: movimientoId, grupoId, origen: { in: ["MANUAL", "LISTADO"] }, estado: "CLASIFICADO", cruzadoConId: null },
    });
    if (!apuntado) throw badRequest("Revisa los datos enviados", { movimientoId: "Ese pago ya no se puede cruzar" });
    if (apuntado.importeCentimos !== duda.importeCentimos) {
      throw badRequest("Revisa los datos enviados", { movimientoId: "Los importes no coinciden" });
    }
    await prisma.$transaction([
      prisma.asignacion.updateMany({ where: { movimientoId: apuntado.id }, data: { movimientoId: duda.id } }),
      prisma.movimiento.update({ where: { id: apuntado.id }, data: { estado: "CRUZADO", cruzadoConId: duda.id } }),
      prisma.movimiento.update({
        where: { id: duda.id, estado: "DUDA" },
        data: {
          estado: "CLASIFICADO",
          motivoDuda: null,
          familiaId: apuntado.familiaId,
          cargosSugeridos: [],
          clasificadoPorId: req.sesion!.usuario.id,
          clasificadoEn: new Date(),
        },
      }),
    ]);
    res.status(204).end();
  }),
);

// D-5: toda clasificacion se puede deshacer.
// - Del banco: vuelve a Dudas con sus cargos sugeridos; si se cruzo con un pago apuntado, este recupera su reparto.
// - Otro ingreso: vuelve a Dudas.
// - Pago a mano o marca del listado: se borra (no es dinero que haya entrado por el banco).
movimientosRouter.post(
  "/:id/deshacer",
  asyncHandler(async (req, res) => {
    const m = await movimientoDelGrupo(req.params.id, req.grupo!.id);
    if (m.estado === "CRUZADO") throw conflict("Está cruzado con un ingreso del banco: deshaz ese ingreso");
    if (m.estado === "DUDA") throw conflict("Este movimiento no está clasificado");

    if (m.estado === "OTRO_INGRESO") {
      await prisma.movimiento.update({
        where: { id: m.id },
        data: { estado: "DUDA", motivoDuda: "DESHECHO", nota: null, clasificadoPorId: null, clasificadoEn: null },
      });
    } else if (m.origen !== "BANCO") {
      await prisma.movimiento.delete({ where: { id: m.id } });
    } else if (m.cruzadoDesde) {
      const apuntado = m.cruzadoDesde;
      await prisma.$transaction([
        prisma.asignacion.updateMany({ where: { movimientoId: m.id }, data: { movimientoId: apuntado.id } }),
        prisma.movimiento.update({ where: { id: apuntado.id }, data: { estado: "CLASIFICADO", cruzadoConId: null } }),
        prisma.movimiento.update({
          where: { id: m.id },
          data: {
            estado: "DUDA",
            motivoDuda: apuntado.origen === "MANUAL" ? "POSIBLE_YA_APUNTADO" : "POSIBLE_YA_MARCADO",
            clasificadoPorId: null,
            clasificadoEn: null,
          },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.asignacion.deleteMany({ where: { movimientoId: m.id } }),
        prisma.movimiento.update({
          where: { id: m.id },
          data: {
            estado: "DUDA",
            motivoDuda: "DESHECHO",
            cargosSugeridos: m.asignaciones.map((a) => a.cargoId),
            clasificadoPorId: null,
            clasificadoEn: null,
          },
        }),
      ]);
    }
    res.status(204).end();
  }),
);
