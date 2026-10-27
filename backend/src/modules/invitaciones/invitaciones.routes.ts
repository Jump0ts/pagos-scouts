import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, conflict, unauthorized } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { contrasenaNuevaSchema } from "../auth/auth.schema.js";
import { crearSesion, hashContrasena, obtenerPerfil, verificarContrasena } from "../auth/auth.utils.js";
import { comprobarBloqueo, registrarExito, registrarFallo } from "../auth/intentos.js";
import { aceptarInvitacionSchema } from "./invitaciones.schema.js";
import { invitacionVigente } from "./invitaciones.utils.js";

// Rutas publicas: las usa quien abre el enlace de invitacion, todavia sin sesion.
export const invitacionesRouter = Router();

invitacionesRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const invitacion = await invitacionVigente(req.params.token);
    const usuario = await prisma.usuario.findUnique({ where: { email: invitacion.email }, select: { id: true } });
    res.json({
      grupo: { nombre: invitacion.grupo.nombre },
      email: invitacion.email,
      rol: invitacion.rol,
      usuarioExiste: Boolean(usuario),
    });
  }),
);

invitacionesRouter.post(
  "/:token/aceptar",
  asyncHandler(async (req, res) => {
    const invitacion = await invitacionVigente(req.params.token);
    const { nombre, contrasena } = validar(aceptarInvitacionSchema, req.body);
    const existente = await prisma.usuario.findUnique({ where: { email: invitacion.email } });

    let nuevo: { nombre: string; hashContrasena: string } | null = null;
    if (existente) {
      // Ya tiene cuenta (por ejemplo, en otro grupo): demuestra que es el con su contrasena actual.
      comprobarBloqueo(invitacion.email);
      if (!(await verificarContrasena(existente.hashContrasena, contrasena))) {
        registrarFallo(invitacion.email);
        throw unauthorized("La contrasena no es correcta");
      }
      registrarExito(invitacion.email);
    } else {
      if (!nombre) throw badRequest("Revisa los datos enviados", { nombre: "Escribe tu nombre" });
      validar(z.object({ contrasena: contrasenaNuevaSchema }), { contrasena });
      nuevo = { nombre, hashContrasena: await hashContrasena(contrasena) };
    }

    const usuarioId = await prisma.$transaction(async (tx) => {
      // Marcar como usada solo si nadie lo ha hecho antes: un enlace no se puede usar dos veces a la vez.
      const { count } = await tx.invitacion.updateMany({
        where: { id: invitacion.id, usadaEn: null },
        data: { usadaEn: new Date() },
      });
      if (count === 0) throw conflict("Esta invitacion ya se ha usado");
      const id = existente
        ? existente.id
        : (await tx.usuario.create({ data: { email: invitacion.email, ...nuevo! } })).id;
      await tx.membresia.create({
        data: {
          usuarioId: id,
          grupoId: invitacion.grupoId,
          rol: invitacion.rol,
          secciones: { create: invitacion.secciones.map((s) => ({ seccionId: s.seccionId })) },
        },
      });
      return id;
    });

    await crearSesion(res, usuarioId, invitacion.grupoId);
    res.status(201).json(await obtenerPerfil(usuarioId, invitacion.grupoId));
  }),
);
