import { Router } from "express";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { conflict, notFound } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { crearInvitacionSchema } from "../invitaciones/invitaciones.schema.js";
import { crearInvitacion } from "../invitaciones/invitaciones.utils.js";
import { crearRestablecimiento } from "../restablecer/restablecer.utils.js";
import { comprobarSeccionesDelGrupo } from "../secciones/secciones.utils.js";
import { editarMiembroSchema } from "./usuarios.schema.js";

// Gestion de las personas del grupo. Solo administradores (se monta detras de requiereRol("ADMIN")).
export const usuariosRouter = Router();

// La membresia se busca siempre junto con el grupo activo: la de otro grupo es, a todos los efectos, inexistente.
const membresiaDelGrupo = async (membresiaId: string, grupoId: string) => {
  const membresia = await prisma.membresia.findFirst({ where: { id: membresiaId, grupoId } });
  if (!membresia) throw notFound("Esa persona no está en el grupo");
  return membresia;
};

// El grupo nunca se puede quedar sin nadie que lo administre.
const comprobarQueQuedaAdmin = async (grupoId: string, membresiaId: string) => {
  const otrosAdmins = await prisma.membresia.count({ where: { grupoId, rol: "ADMIN", id: { not: membresiaId } } });
  if (otrosAdmins === 0) throw conflict("El grupo necesita al menos un administrador");
};

usuariosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const grupoId = req.grupo!.id;
    const [miembros, invitaciones] = await Promise.all([
      prisma.membresia.findMany({
        where: { grupoId },
        orderBy: { creadoEn: "asc" },
        select: {
          id: true,
          rol: true,
          usuario: { select: { id: true, nombre: true, email: true } },
          secciones: { select: { seccionId: true } },
        },
      }),
      prisma.invitacion.findMany({
        where: { grupoId, usadaEn: null, expiraEn: { gt: new Date() } },
        orderBy: { creadaEn: "desc" },
        select: { id: true, email: true, rol: true, expiraEn: true, secciones: { select: { seccionId: true } } },
      }),
    ]);

    res.json({
      miembros: miembros.map((m) => ({
        membresiaId: m.id,
        usuario: m.usuario,
        rol: m.rol,
        seccionIds: m.secciones.map((s) => s.seccionId),
        esTuCuenta: m.usuario.id === req.sesion!.usuario.id,
      })),
      invitaciones: invitaciones.map((i) => ({
        id: i.id,
        email: i.email,
        rol: i.rol,
        expiraEn: i.expiraEn,
        seccionIds: i.secciones.map((s) => s.seccionId),
      })),
    });
  }),
);

usuariosRouter.post(
  "/invitaciones",
  asyncHandler(async (req, res) => {
    const datos = validar(crearInvitacionSchema, req.body);
    const resultado = await crearInvitacion({ ...datos, grupoId: req.grupo!.id, creadaPorId: req.sesion!.usuario.id });
    res.status(201).json(resultado);
  }),
);

usuariosRouter.delete(
  "/invitaciones/:id",
  asyncHandler(async (req, res) => {
    const { count } = await prisma.invitacion.deleteMany({
      where: { id: req.params.id, grupoId: req.grupo!.id, usadaEn: null },
    });
    if (count === 0) throw notFound("Invitación no encontrada");
    res.status(204).end();
  }),
);

usuariosRouter.patch(
  "/:membresiaId",
  asyncHandler(async (req, res) => {
    const grupoId = req.grupo!.id;
    const { rol, seccionIds } = validar(editarMiembroSchema, req.body);
    const membresia = await membresiaDelGrupo(req.params.membresiaId, grupoId);
    if (membresia.rol === "ADMIN" && rol !== "ADMIN") await comprobarQueQuedaAdmin(grupoId, membresia.id);

    const secciones = rol === "SCOUTER" ? await comprobarSeccionesDelGrupo(grupoId, seccionIds) : [];
    await prisma.membresia.update({
      where: { id: membresia.id },
      data: {
        rol,
        secciones: { deleteMany: {}, create: secciones.map((seccionId) => ({ seccionId })) },
      },
    });
    res.json({ membresiaId: membresia.id, rol, seccionIds: secciones });
  }),
);

usuariosRouter.delete(
  "/:membresiaId",
  asyncHandler(async (req, res) => {
    const grupoId = req.grupo!.id;
    const membresia = await membresiaDelGrupo(req.params.membresiaId, grupoId);
    if (membresia.rol === "ADMIN") await comprobarQueQuedaAdmin(grupoId, membresia.id);

    // Se quita del grupo; su cuenta sigue existiendo por si pertenece a otros grupos.
    await prisma.membresia.delete({ where: { id: membresia.id } });
    res.status(204).end();
  }),
);

usuariosRouter.post(
  "/:membresiaId/restablecer",
  asyncHandler(async (req, res) => {
    const membresia = await membresiaDelGrupo(req.params.membresiaId, req.grupo!.id);
    res.status(201).json(await crearRestablecimiento(membresia.usuarioId));
  }),
);
