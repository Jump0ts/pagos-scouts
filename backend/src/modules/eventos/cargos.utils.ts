import type { Cargo, Prisma } from "@prisma/client";
import { prisma } from "../../prisma.js";

export type EstadoPago = "PENDIENTE" | "PARCIAL" | "PAGADO" | "EXENTO";

export const importeDe = (c: Pick<Cargo, "importeAjustadoCentimos" | "importeCalculadoCentimos">) =>
  c.importeAjustadoCentimos ?? c.importeCalculadoCentimos;

export const estadoDe = (debido: number, pagado: number): EstadoPago =>
  debido === 0 ? "EXENTO" : pagado >= debido ? "PAGADO" : pagado > 0 ? "PARCIAL" : "PENDIENTE";

/** Lo pagado de cada cargo: la suma de sus asignaciones (los que no tienen ninguna no aparecen). */
export const pagadoPorCargo = async (cargoIds: string[], cliente: Prisma.TransactionClient = prisma) => {
  if (!cargoIds.length) return new Map<string, number>();
  const filas = await cliente.asignacion.groupBy({
    by: ["cargoId"],
    where: { cargoId: { in: cargoIds } },
    _sum: { importeCentimos: true },
  });
  return new Map(filas.map((f) => [f.cargoId, f._sum.importeCentimos ?? 0]));
};
