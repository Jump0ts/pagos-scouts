import { env } from "../../env.js";
import { prisma } from "../../prisma.js";
import { notFound } from "../../utils/errors.js";
import { enHoras, generarToken, hashToken } from "../../utils/tokens.js";

export const DURACION_RESTABLECIMIENTO_HORAS = 24;

// D-21: enlace de un solo uso. Un enlace nuevo anula los anteriores sin usar.
export const crearRestablecimiento = async (usuarioId: string) => {
  const token = generarToken();
  const expiraEn = enHoras(DURACION_RESTABLECIMIENTO_HORAS);
  await prisma.$transaction([
    prisma.restablecimiento.deleteMany({ where: { usuarioId, usadoEn: null } }),
    prisma.restablecimiento.create({ data: { usuarioId, hashToken: hashToken(token), expiraEn } }),
  ]);
  return { enlace: `${env.PUBLIC_URL}/restablecer/${token}`, expiraEn };
};

export const restablecimientoVigente = async (token: string) => {
  const restablecimiento = await prisma.restablecimiento.findUnique({
    where: { hashToken: hashToken(token) },
    include: { usuario: { select: { email: true } } },
  });
  if (!restablecimiento || restablecimiento.usadoEn || restablecimiento.expiraEn <= new Date()) {
    throw notFound("Este enlace no existe o ha caducado");
  }
  return restablecimiento;
};
