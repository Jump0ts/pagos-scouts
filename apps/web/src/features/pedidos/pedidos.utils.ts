import type { Articulo, Eleccion, LineaEntrada } from "./pedidos.types";

// "Camiseta · XL · Nombre al dorso «Nora»": una unidad en una linea de texto.
export const describirLinea = (articulo: string, elecciones: Eleccion[]) =>
  [articulo, ...elecciones.map((e) => (e.tipo === "TEXTO" ? `${e.opcion} «${e.valor}»` : e.valor))].join(" · ");

// El mismo precio que calcula la API (D-66), para ir mostrando el total mientras se rellena.
export const precioDe = (articulo: Articulo, linea: LineaEntrada) =>
  articulo.opciones.reduce((total, o) => {
    const e = linea.elecciones.find((x) => x.opcionId === o.id);
    if (o.tipo === "LISTA") return total + (o.valores.find((v) => v.id === e?.valorId)?.suplementoCentimos ?? 0);
    return total + (e?.texto?.trim() ? o.suplementoCentimos : 0);
  }, articulo.precioCentimos);

// Lo mismo que acepta la API: empieza por letra o numero y solo signos sencillos (D-70).
export const TEXTO_SEGURO = /^[\p{L}\p{N}][\p{L}\p{N} .,'’()/+-]*$/u;
export const NOMBRE_SEGURO = /^\p{L}[\p{L} .'’-]*$/u;

/** Lo que falta o sobra en una unidad antes de mandarla; null si esta bien. */
export const problemaDe = (articulo: Articulo, linea: LineaEntrada) => {
  for (const o of articulo.opciones) {
    const e = linea.elecciones.find((x) => x.opcionId === o.id);
    if (o.tipo === "LISTA" && o.obligatoria && !e?.valorId) return `Elige ${o.nombre.toLowerCase()}`;
    if (o.tipo === "TEXTO") {
      const texto = e?.texto?.trim() ?? "";
      if (!texto && o.obligatoria) return `Escribe ${o.nombre.toLowerCase()}`;
      if (texto && texto.length > (o.maxLongitud ?? 0)) return `${o.nombre}: como mucho ${o.maxLongitud} caracteres`;
      if (texto && !TEXTO_SEGURO.test(texto)) return `${o.nombre}: usa solo letras, números y espacios`;
    }
  }
  return null;
};

/** Cambia lo elegido de una opcion en una unidad (sin tocar el resto). */
export const conEleccion = (linea: LineaEntrada, opcionId: string, cambio: { valorId?: string; texto?: string }): LineaEntrada => ({
  ...linea,
  elecciones: [...linea.elecciones.filter((e) => e.opcionId !== opcionId), { opcionId, ...cambio }],
});
