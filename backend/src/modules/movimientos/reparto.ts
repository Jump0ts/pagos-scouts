import type { Prisma } from "@prisma/client";
import { badRequest } from "../../utils/errors.js";
import { importeDe } from "../eventos/cargos.utils.js";

type Db = Prisma.TransactionClient;

export type AsignacionPedida = { cargoId: string; importeCentimos: number };

/**
 * Comprueba el reparto de un pago entre deudas: todas de una misma familia del grupo (D-52), cada importe como mucho
 * lo que le falta a su cargo (se admiten pagos parciales, D-5b) y la suma como mucho el pago (lo que sobre es saldo
 * de la familia, D-48).
 */
export const comprobarReparto = async (db: Db, grupoId: string, familiaId: string, asignaciones: AsignacionPedida[], importeCentimos: number) => {
  const familia = await db.familia.findFirst({ where: { id: familiaId, grupoId }, select: { id: true } });
  if (!familia) throw badRequest("Revisa los datos enviados", { familiaId: "Familia no encontrada" });

  const ids = asignaciones.map((a) => a.cargoId);
  if (new Set(ids).size !== ids.length) throw badRequest("Revisa los datos enviados", { asignaciones: "Una deuda aparece dos veces" });
  const cargos = await db.cargo.findMany({
    where: { id: { in: ids }, estado: "ACTIVO", educando: { familiaId, grupoId } },
    include: { asignaciones: { select: { importeCentimos: true } }, evento: { select: { nombre: true } }, educando: { select: { nombre: true } } },
  });
  if (cargos.length !== ids.length) {
    throw badRequest("Revisa los datos enviados", { asignaciones: "Alguna deuda no es de esta familia" });
  }
  for (const a of asignaciones) {
    const c = cargos.find((x) => x.id === a.cargoId)!;
    const pendiente = importeDe(c) - c.asignaciones.reduce((n, x) => n + x.importeCentimos, 0);
    if (a.importeCentimos > pendiente) {
      throw badRequest("Revisa los datos enviados", {
        asignaciones: `A ${c.evento.nombre} de ${c.educando.nombre} solo le faltan ${(Math.max(0, pendiente) / 100).toFixed(2).replace(".", ",")} €`,
      });
    }
  }
  if (asignaciones.reduce((n, a) => n + a.importeCentimos, 0) > importeCentimos) {
    throw badRequest("Revisa los datos enviados", { asignaciones: "El reparto suma más que el pago" });
  }
};

// D-48: lo que no se repartio de cada pago clasificado de la familia, del mas antiguo al mas reciente.
const sobrantes = async (db: Db, familiaId: string) => {
  const pagos = await db.movimiento.findMany({
    where: { familiaId, estado: "CLASIFICADO" },
    orderBy: [{ fecha: { sort: "asc", nulls: "first" } }, { creadoEn: "asc" }],
    select: { id: true, importeCentimos: true, asignaciones: { select: { importeCentimos: true } } },
  });
  return pagos
    .map((p) => ({ id: p.id, sobrante: p.importeCentimos - p.asignaciones.reduce((n, a) => n + a.importeCentimos, 0) }))
    .filter((p) => p.sobrante > 0);
};

export const saldoDe = async (db: Db, familiaId: string) => (await sobrantes(db, familiaId)).reduce((n, p) => n + p.sobrante, 0);

/** Aplica el saldo de la familia a una de sus deudas: tanto como haya, hasta lo que le falte. Devuelve lo aplicado. */
export const aplicarSaldo = async (db: Db, familiaId: string, cargoId: string) => {
  const cargo = await db.cargo.findFirst({
    where: { id: cargoId, estado: "ACTIVO", educando: { familiaId } },
    include: { asignaciones: { select: { importeCentimos: true } } },
  });
  if (!cargo) throw badRequest("Revisa los datos enviados", { cargoId: "Esa deuda no es de esta familia" });
  let falta = importeDe(cargo) - cargo.asignaciones.reduce((n, a) => n + a.importeCentimos, 0);
  if (falta <= 0) throw badRequest("Esta deuda ya está pagada");

  let aplicado = 0;
  for (const p of await sobrantes(db, familiaId)) {
    if (falta <= 0) break;
    const usar = Math.min(p.sobrante, falta);
    await db.asignacion.upsert({
      where: { movimientoId_cargoId: { movimientoId: p.id, cargoId } },
      create: { movimientoId: p.id, cargoId, importeCentimos: usar },
      update: { importeCentimos: { increment: usar } },
    });
    falta -= usar;
    aplicado += usar;
  }
  if (!aplicado) throw badRequest("Esta familia no tiene saldo a favor");
  return aplicado;
};
