import type { CargoVista, EventoConResumen } from "./eventos.types";

export const hoy = () => new Date().toISOString().slice(0, 10);

// D-57: en Inicio, los eventos que siguen abiertos o a los que aún les falta algo por cobrar.
export const enSeguimiento = (e: EventoConResumen) => e.fechaFin >= hoy() || e.resumen.pagadoCentimos < e.resumen.debidoCentimos;

type Nino = CargoVista["educando"];

// "Sara G."; si dos niños de la lista quedan igual, con los apellidos completos.
const nombresCortos = (ninos: Nino[]) => {
  const corto = (n: Nino) => (n.apellidos ? `${n.nombre} ${n.apellidos.trim()[0].toUpperCase()}.` : n.nombre);
  const veces = new Map<string, number>();
  for (const n of ninos) veces.set(corto(n), (veces.get(corto(n)) ?? 0) + 1);
  return (n: Nino) => (veces.get(corto(n))! > 1 ? `${n.nombre} ${n.apellidos}`.trim() : corto(n));
};

/** D-58: quién falta por pagar, sin importes, para pegarlo en el grupo de familias. */
export const textoRecordatorio = (evento: string, seccion: string | null, cargos: CargoVista[]) => {
  const faltan = cargos.filter((c) => c.estado === "PENDIENTE" || c.estado === "PARCIAL");
  const nombre = nombresCortos(faltan.map((c) => c.educando));
  return [
    `📌 ${evento}${seccion ? ` (${seccion})` : ""}`,
    "Faltan por pagar:",
    ...faltan.map((c) => `• ${nombre(c.educando)}${c.estado === "PARCIAL" ? " (a medias)" : ""}`),
    "",
    "Si ya lo habéis pagado, avisadnos. ¡Gracias!",
  ].join("\n");
};
