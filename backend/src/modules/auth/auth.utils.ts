import { hash, verify } from "@node-rs/argon2";
import type { Response } from "express";
import { env } from "../../env.js";
import { prisma } from "../../prisma.js";
import { enDias, generarToken, hashToken } from "../../utils/tokens.js";
import type { Perfil } from "./auth.types.js";

export const COOKIE_SESION = "sesion";
export const DURACION_SESION_DIAS = 30;

// argon2id con los parametros por defecto de la libreria (los recomendados por OWASP).
export const hashContrasena = (contrasena: string) => hash(contrasena);

export const verificarContrasena = (hashGuardado: string, contrasena: string) =>
  verify(hashGuardado, contrasena).catch(() => false);

// Cuando el email no existe se hace igualmente una verificacion completa, para que el tiempo de respuesta no
// delate que emails tienen cuenta.
let hashFicticio: Promise<string> | null = null;
export const verificarSinUsuario = async (contrasena: string) => {
  hashFicticio ??= hash("contrasena-ficticia-solo-para-igualar-tiempos");
  await verificarContrasena(await hashFicticio, contrasena);
  return false;
};

const opcionesCookie = (expira?: Date) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  ...(expira ? { expires: expira } : {}),
});

export const crearSesion = async (res: Response, usuarioId: string, grupoActivoId: string | null) => {
  const token = generarToken();
  const expiraEn = enDias(DURACION_SESION_DIAS);
  await prisma.sesion.create({ data: { hashToken: hashToken(token), usuarioId, grupoActivoId, expiraEn } });
  res.cookie(COOKIE_SESION, token, opcionesCookie(expiraEn));
};

export const borrarCookieSesion = (res: Response) => {
  res.clearCookie(COOKIE_SESION, opcionesCookie());
};

export const primerGrupoDe = async (usuarioId: string) => {
  const membresia = await prisma.membresia.findFirst({ where: { usuarioId }, orderBy: { creadoEn: "asc" } });
  return membresia?.grupoId ?? null;
};

export const obtenerPerfil = async (usuarioId: string, grupoActivoId: string | null): Promise<Perfil> => {
  const usuario = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: {
      id: true,
      nombre: true,
      email: true,
      membresias: {
        orderBy: { creadoEn: "asc" },
        select: {
          rol: true,
          grupo: { select: { id: true, nombre: true } },
          secciones: { select: { seccionId: true } },
        },
      },
    },
  });

  const activa = usuario.membresias.find((m) => m.grupo.id === grupoActivoId);
  return {
    usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
    grupos: usuario.membresias.map((m) => ({ id: m.grupo.id, nombre: m.grupo.nombre, rol: m.rol })),
    grupoActivo: activa
      ? {
          id: activa.grupo.id,
          nombre: activa.grupo.nombre,
          rol: activa.rol,
          seccionIds: activa.secciones.map((s) => s.seccionId),
        }
      : null,
  };
};
