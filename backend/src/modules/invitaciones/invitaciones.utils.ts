import type { Rol } from "@prisma/client";
import { env } from "../../env.js";
import { prisma } from "../../prisma.js";
import { conflict, notFound } from "../../utils/errors.js";
import { enDias, generarToken, hashToken } from "../../utils/tokens.js";
import { comprobarSeccionesDelGrupo } from "../secciones/secciones.utils.js";

export const DURACION_INVITACION_DIAS = 7;

type NuevaInvitacion = {
  grupoId: string;
  email: string;
  rol: Rol;
  seccionIds: string[];
  creadaPorId: string | null;
};

// D-15: crea la invitacion y devuelve el enlace. El token solo existe en ese enlace; aqui se guarda su hash.
export const crearInvitacion = async ({ grupoId, email, rol, seccionIds, creadaPorId }: NuevaInvitacion) => {
  const yaMiembro = await prisma.membresia.findFirst({ where: { grupoId, usuario: { email } } });
  if (yaMiembro) throw conflict("Esa persona ya pertenece al grupo");

  const secciones = rol === "SCOUTER" ? await comprobarSeccionesDelGrupo(grupoId, seccionIds) : [];
  const token = generarToken();

  const invitacion = await prisma.$transaction(async (tx) => {
    // Una sola invitacion pendiente por persona y grupo: la nueva sustituye a la anterior.
    await tx.invitacion.deleteMany({ where: { grupoId, email, usadaEn: null } });
    return tx.invitacion.create({
      data: {
        grupoId,
        email,
        rol,
        creadaPorId,
        hashToken: hashToken(token),
        expiraEn: enDias(DURACION_INVITACION_DIAS),
        secciones: { create: secciones.map((seccionId) => ({ seccionId })) },
      },
      select: { id: true, email: true, rol: true, expiraEn: true, secciones: { select: { seccionId: true } } },
    });
  });

  return {
    invitacion: {
      id: invitacion.id,
      email: invitacion.email,
      rol: invitacion.rol,
      expiraEn: invitacion.expiraEn,
      seccionIds: invitacion.secciones.map((s) => s.seccionId),
    },
    enlace: `${env.PUBLIC_URL}/invitacion/${token}`,
  };
};

// Una invitacion usada, caducada o inventada responde igual: no se da ninguna pista.
export const invitacionVigente = async (token: string) => {
  const invitacion = await prisma.invitacion.findUnique({
    where: { hashToken: hashToken(token) },
    include: { grupo: { select: { nombre: true } }, secciones: { select: { seccionId: true } } },
  });
  if (!invitacion || invitacion.usadaEn || invitacion.expiraEn <= new Date()) {
    throw notFound("Esta invitación no existe o ha caducado");
  }
  return invitacion;
};
