import { Router } from "express";
import { requiereSesion } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, forbidden, unauthorized } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { cambiarContrasenaSchema, grupoActivoSchema, loginSchema } from "./auth.schema.js";
import {
  borrarCookieSesion,
  crearSesion,
  hashContrasena,
  obtenerPerfil,
  primerGrupoDe,
  verificarContrasena,
  verificarSinUsuario,
} from "./auth.utils.js";
import { comprobarBloqueo, registrarExito, registrarFallo } from "./intentos.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, contrasena } = validar(loginSchema, req.body);
    comprobarBloqueo(email);

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    const correcta = usuario
      ? await verificarContrasena(usuario.hashContrasena, contrasena)
      : await verificarSinUsuario(contrasena);
    if (!usuario || !correcta) {
      registrarFallo(email);
      // El mismo mensaje exista o no el email: no se revela quien tiene cuenta.
      throw unauthorized("Email o contraseña incorrectos");
    }

    registrarExito(email);
    const grupoActivoId = await primerGrupoDe(usuario.id);
    await crearSesion(res, usuario.id, grupoActivoId);
    res.json(await obtenerPerfil(usuario.id, grupoActivoId));
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    if (req.sesion) await prisma.sesion.deleteMany({ where: { id: req.sesion.id } });
    borrarCookieSesion(res);
    res.status(204).end();
  }),
);

authRouter.get(
  "/yo",
  requiereSesion,
  asyncHandler(async (req, res) => {
    const { usuario, grupoActivoId } = req.sesion!;
    res.json(await obtenerPerfil(usuario.id, grupoActivoId));
  }),
);

authRouter.put(
  "/contrasena",
  requiereSesion,
  asyncHandler(async (req, res) => {
    const { actual, nueva } = validar(cambiarContrasenaSchema, req.body);
    const { id: sesionId, usuario } = req.sesion!;
    const guardado = await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } });
    if (!(await verificarContrasena(guardado.hashContrasena, actual))) {
      throw badRequest("Revisa los datos enviados", { actual: "La contraseña actual no es correcta" });
    }

    const hash = await hashContrasena(nueva);
    await prisma.$transaction([
      prisma.usuario.update({ where: { id: usuario.id }, data: { hashContrasena: hash } }),
      // Las demas sesiones (otros dispositivos) se cierran; esta sigue abierta.
      prisma.sesion.deleteMany({ where: { usuarioId: usuario.id, id: { not: sesionId } } }),
    ]);
    res.status(204).end();
  }),
);

authRouter.put(
  "/grupo-activo",
  requiereSesion,
  asyncHandler(async (req, res) => {
    const { grupoId } = validar(grupoActivoSchema, req.body);
    const { id, usuario } = req.sesion!;
    const membresia = await prisma.membresia.findUnique({
      where: { usuarioId_grupoId: { usuarioId: usuario.id, grupoId } },
    });
    if (!membresia) throw forbidden("No perteneces a ese grupo");

    await prisma.sesion.update({ where: { id }, data: { grupoActivoId: grupoId } });
    res.json(await obtenerPerfil(usuario.id, grupoId));
  }),
);
