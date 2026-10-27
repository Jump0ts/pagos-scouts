import type { Rol } from "@prisma/client";
import type { RequestHandler } from "express";
import { borrarCookieSesion, COOKIE_SESION } from "../modules/auth/auth.utils.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { forbidden, unauthorized } from "../utils/errors.js";
import { hashToken } from "../utils/tokens.js";

// Lee la cookie de sesion (si la hay) y deja en req.sesion quien es el usuario. No bloquea nada por si sola.
export const cargarSesion = asyncHandler(async (req, res, next) => {
  const token: unknown = req.cookies?.[COOKIE_SESION];
  if (typeof token === "string" && token) {
    const sesion = await prisma.sesion.findUnique({
      where: { hashToken: hashToken(token) },
      select: {
        id: true,
        expiraEn: true,
        grupoActivoId: true,
        usuario: { select: { id: true, nombre: true, email: true } },
      },
    });
    if (sesion && sesion.expiraEn > new Date()) {
      req.sesion = { id: sesion.id, usuario: sesion.usuario, grupoActivoId: sesion.grupoActivoId };
    } else {
      if (sesion) await prisma.sesion.deleteMany({ where: { id: sesion.id } });
      borrarCookieSesion(res);
    }
  }
  next();
});

export const requiereSesion: RequestHandler = (req, _res, next) => {
  next(req.sesion ? undefined : unauthorized());
};

// Comprueba en cada peticion que el usuario sigue perteneciendo al grupo activo: si un admin le quita del grupo,
// pierde el acceso al momento, aunque su sesion siga abierta.
export const requiereGrupo = asyncHandler(async (req, _res, next) => {
  if (!req.sesion) throw unauthorized();
  const { grupoActivoId, usuario } = req.sesion;
  const membresia = grupoActivoId
    ? await prisma.membresia.findUnique({
        where: { usuarioId_grupoId: { usuarioId: usuario.id, grupoId: grupoActivoId } },
        select: { id: true, grupoId: true, rol: true, secciones: { select: { seccionId: true } } },
      })
    : null;
  if (!membresia) throw forbidden("Elige un grupo para continuar");

  req.grupo = {
    id: membresia.grupoId,
    membresiaId: membresia.id,
    rol: membresia.rol,
    seccionIds: membresia.secciones.map((s) => s.seccionId),
  };
  next();
});

export const requiereRol =
  (...roles: Rol[]): RequestHandler =>
  (req, _res, next) => {
    next(req.grupo && roles.includes(req.grupo.rol) ? undefined : forbidden());
  };
