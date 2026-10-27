import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { conflict } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { contrasenaNuevaSchema } from "../auth/auth.schema.js";
import { hashContrasena } from "../auth/auth.utils.js";
import { registrarExito } from "../auth/intentos.js";
import { restablecimientoVigente } from "./restablecer.utils.js";

// Rutas publicas: las usa quien abre el enlace para elegir una contrasena nueva.
export const restablecerRouter = Router();

restablecerRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const restablecimiento = await restablecimientoVigente(req.params.token);
    res.json({ email: restablecimiento.usuario.email });
  }),
);

restablecerRouter.post(
  "/:token",
  asyncHandler(async (req, res) => {
    const restablecimiento = await restablecimientoVigente(req.params.token);
    const { contrasena } = validar(z.object({ contrasena: contrasenaNuevaSchema }), req.body);
    const hash = await hashContrasena(contrasena);

    await prisma.$transaction(async (tx) => {
      const { count } = await tx.restablecimiento.updateMany({
        where: { id: restablecimiento.id, usadoEn: null },
        data: { usadoEn: new Date() },
      });
      if (count === 0) throw conflict("Este enlace ya se ha usado");
      await tx.usuario.update({ where: { id: restablecimiento.usuarioId }, data: { hashContrasena: hash } });
      // Cualquier sesion abierta con la contrasena anterior deja de valer.
      await tx.sesion.deleteMany({ where: { usuarioId: restablecimiento.usuarioId } });
    });

    registrarExito(restablecimiento.usuario.email);
    res.status(204).end();
  }),
);
