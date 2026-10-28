import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma.js";

// El curso scout va de septiembre a agosto: en octubre de 2026 estamos en "2026-27"; en marzo de 2027, tambien.
export const nombreCursoPara = (fecha = new Date()) => {
  const inicio = fecha.getMonth() >= 8 ? fecha.getFullYear() : fecha.getFullYear() - 1;
  return `${inicio}-${String((inicio + 1) % 100).padStart(2, "0")}`;
};

export const FORMATO_CURSO = /^\d{4}-\d{2}$/;

export const cursoActivo = (grupoId: string, cliente: Prisma.TransactionClient = prisma) =>
  cliente.curso.findFirst({ where: { grupoId, activo: true } });

// Devuelve el curso con ese nombre; si no existe lo crea, y si el grupo aun no tiene curso activo, este lo sera.
export const obtenerOCrearCurso = async (tx: Prisma.TransactionClient, grupoId: string, nombre: string) => {
  const existente = await tx.curso.findUnique({ where: { grupoId_nombre: { grupoId, nombre } } });
  if (existente) return existente;
  const hayActivo = await cursoActivo(grupoId, tx);
  return tx.curso.create({ data: { grupoId, nombre, activo: !hayActivo } });
};
