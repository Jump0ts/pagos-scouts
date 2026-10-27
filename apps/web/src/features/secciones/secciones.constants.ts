import type { ColorSeccion } from "./secciones.types";

// Tokens del tema (styles/tema.css). Las clases van escritas enteras para que Tailwind las genere.
export const COLORES_SECCION: { valor: ColorSeccion; etiqueta: string; fondo: string }[] = [
  { valor: "castores", etiqueta: "Naranja", fondo: "bg-castores" },
  { valor: "manada", etiqueta: "Amarillo", fondo: "bg-manada" },
  { valor: "tropa", etiqueta: "Verde", fondo: "bg-tropa" },
  { valor: "unidad", etiqueta: "Granate", fondo: "bg-unidad" },
  { valor: "clan", etiqueta: "Rojo", fondo: "bg-clan" },
  { valor: "scouters", etiqueta: "Morado", fondo: "bg-scouters" },
];

export const FONDO_SECCION = Object.fromEntries(COLORES_SECCION.map((c) => [c.valor, c.fondo])) as Record<ColorSeccion, string>;
