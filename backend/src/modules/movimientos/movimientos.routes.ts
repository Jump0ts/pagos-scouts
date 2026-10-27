import express, { Router } from "express";
import { z } from "zod";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { importeDe } from "../eventos/cargos.utils.js";
import { leerMovimientosBanco } from "./banco.parser.js";
import { importarMovimientos } from "./movimientos.importar.js";
import type { MovimientoVista } from "./movimientos.types.js";

// D-16, D-41: los movimientos del banco solo los ven Admin y Tesoreria.
export const movimientosRouter = Router();
movimientosRouter.use(requiereRol("ADMIN", "TESORERIA"));

const MAX_LISTA = 300;
const filtroSchema = z.object({ estado: z.enum(["DUDA", "CLASIFICADO"]).default("DUDA") });

const ficheroDe = (body: unknown) => {
  if (!Buffer.isBuffer(body) || body.length === 0) throw badRequest("Sube un fichero");
  return leerMovimientosBanco(body);
};
const recibirFichero = express.raw({ type: "application/octet-stream", limit: "5mb" });

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
        include: {
          familia: { select: { id: true, nombre: true } },
          clasificadoPor: { select: { nombre: true } },
          asignaciones: {
            include: { cargo: { select: { evento: { select: { nombre: true } }, educando: { select: { nombre: true } } } } },
          },
        },
      }),
    ]);

    // Los cargos sugeridos de las dudas, con lo que les falta por pagar.
    const sugeridos = await prisma.cargo.findMany({
      where: { id: { in: movimientos.flatMap((m) => m.cargosSugeridos) }, evento: { grupoId } },
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

    const cuenta = (e: string) => contadores.find((c) => c.estado === e)?._count ?? 0;
    res.json({
      contadores: { dudas: cuenta("DUDA"), clasificados: cuenta("CLASIFICADO") },
      movimientos: movimientos.map(
        (m): MovimientoVista => ({
          id: m.id,
          origen: m.origen,
          fecha: m.fecha?.toISOString().slice(0, 10) ?? null,
          concepto: m.concepto,
          importeCentimos: m.importeCentimos,
          estado: m.estado,
          motivo: m.motivoDuda,
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
                return [{ cargoId: id, evento: c.evento.nombre, educando: c.educando.nombre, importeCentimos: Math.max(0, pendiente) }];
              }),
          clasificadoPor: m.clasificadoPor?.nombre ?? null,
          clasificadoEn: m.clasificadoEn?.toISOString() ?? null,
        }),
      ),
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

// D-5: toda clasificacion se puede deshacer. Un movimiento del banco vuelve a Dudas con sus cargos sugeridos; una
// marca del listado desaparece (no es dinero que haya entrado por el banco).
movimientosRouter.post(
  "/:id/deshacer",
  asyncHandler(async (req, res) => {
    const movimiento = await prisma.movimiento.findFirst({
      where: { id: req.params.id, grupoId: req.grupo!.id },
      include: { asignaciones: { select: { cargoId: true } } },
    });
    if (!movimiento) throw notFound("Movimiento no encontrado");
    if (movimiento.estado !== "CLASIFICADO") throw conflict("Este movimiento no está clasificado");

    if (movimiento.origen === "LISTADO") {
      await prisma.movimiento.delete({ where: { id: movimiento.id } });
    } else {
      await prisma.$transaction([
        prisma.asignacion.deleteMany({ where: { movimientoId: movimiento.id } }),
        prisma.movimiento.update({
          where: { id: movimiento.id },
          data: {
            estado: "DUDA",
            motivoDuda: "DESHECHO",
            cargosSugeridos: movimiento.asignaciones.map((a) => a.cargoId),
            clasificadoPorId: null,
            clasificadoEn: null,
          },
        }),
      ]);
    }
    res.status(204).end();
  }),
);
