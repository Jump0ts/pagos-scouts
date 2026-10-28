import { aCentimos } from "@/utils/dinero";
import type { AsignacionPedida } from "./movimientos.types";

// Lo escrito en el reparto (deuda -> importe en euros como texto) pasado a céntimos, con lo que falta por repartir.
export const leerReparto = (importes: Record<string, string>, totalCentimos: number | null) => {
  const asignaciones: AsignacionPedida[] = [];
  let malEscritos = 0;
  for (const [cargoId, texto] of Object.entries(importes)) {
    const centimos = aCentimos(texto);
    if (centimos === null || centimos <= 0) malEscritos += 1;
    else asignaciones.push({ cargoId, importeCentimos: centimos });
  }
  const repartido = asignaciones.reduce((n, a) => n + a.importeCentimos, 0);
  return { asignaciones, repartido, malEscritos, sobra: totalCentimos === null ? null : totalCentimos - repartido };
};
