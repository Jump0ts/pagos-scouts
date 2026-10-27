import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { badRequest } from "../../utils/errors.js";
import { SECCIONES_POR_DEFECTO } from "./secciones.constants.js";

export const crearSeccionesPorDefecto = (tx: Prisma.TransactionClient, grupoId: string) =>
  tx.seccion.createMany({
    data: SECCIONES_POR_DEFECTO.map((s, orden) => ({ grupoId, nombre: s.nombre, color: s.color, orden })),
  });

// Las secciones que se asignan a un scouter tienen que ser del mismo grupo y no estar archivadas.
export const comprobarSeccionesDelGrupo = async (grupoId: string, seccionIds: string[]) => {
  const unicas = [...new Set(seccionIds)];
  const validas = await prisma.seccion.count({ where: { grupoId, archivada: false, id: { in: unicas } } });
  if (validas !== unicas.length) throw badRequest("Alguna sección no existe en este grupo", { seccionIds: "Sección no válida" });
  return unicas;
};
