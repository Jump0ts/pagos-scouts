import type { Prisma } from "@prisma/client";
import { badRequest } from "../../utils/errors.js";
import { importeDe } from "../eventos/cargos.utils.js";
import type { ConfirmarListado } from "./importaciones.schema.js";

type Marcado = { educandoId: string; familiaId: string; claves: string[] };

/**
 * D-44: cada marca "Pagado" de una columna ligada a un evento crea un pago "marcado en el listado" por lo que le
 * falta al cargo del niño. Reimportar el mismo listado no duplica nada: un cargo ya pagado se salta.
 */
export const importarMarcas = async (
  tx: Prisma.TransactionClient,
  grupoId: string,
  cursoId: string,
  usuarioId: string,
  columnas: ConfirmarListado["columnasPago"],
  marcados: Marcado[],
) => {
  const resumen = { marcasImportadas: 0, marcasSinCargo: 0, marcasYaPagadas: 0 };
  if (!columnas.length) return resumen;

  const eventoIds = [...new Set(columnas.map((c) => c.eventoId))];
  const eventos = await tx.evento.count({ where: { id: { in: eventoIds }, grupoId, cursoId } });
  if (eventos !== eventoIds.length) {
    throw badRequest("Algún evento elegido para las marcas «Pagado» no es de este curso", { columnasPago: "Evento no válido" });
  }
  const columnaDe = new Map(columnas.map((c) => [c.clave, c]));

  for (const nino of marcados) {
    for (const clave of nino.claves) {
      const columna = columnaDe.get(clave);
      if (!columna) continue;
      const cargo = await tx.cargo.findUnique({
        where: { eventoId_educandoId: { eventoId: columna.eventoId, educandoId: nino.educandoId } },
        include: { asignaciones: { select: { importeCentimos: true } } },
      });
      if (!cargo || cargo.estado !== "ACTIVO") {
        resumen.marcasSinCargo += 1;
        continue;
      }
      const pendiente = importeDe(cargo) - cargo.asignaciones.reduce((n, a) => n + a.importeCentimos, 0);
      if (pendiente <= 0) {
        resumen.marcasYaPagadas += 1;
        continue;
      }
      await tx.movimiento.create({
        data: {
          grupoId,
          origen: "LISTADO",
          concepto: `Marcado como pagado en el listado (${columna.titulo})`,
          importeCentimos: pendiente,
          estado: "CLASIFICADO",
          familiaId: nino.familiaId,
          clasificadoPorId: usuarioId,
          clasificadoEn: new Date(),
          importadoPorId: usuarioId,
          asignaciones: { create: { cargoId: cargo.id, importeCentimos: pendiente } },
        },
      });
      resumen.marcasImportadas += 1;
    }
  }
  return resumen;
};
