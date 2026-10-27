import type { MotivoDuda } from "./movimientos.types";

// Por qué un movimiento está en Dudas (D-5): la etiqueta corta y la explicación.
export const MOTIVOS: Record<MotivoDuda, { etiqueta: string; explicacion: string }> = {
  PAGADOR_DESCONOCIDO: {
    etiqueta: "Pagador desconocido",
    explicacion: "Su nombre no se parece al de ningún responsable del listado.",
  },
  FAMILIA_SIN_CONFIRMAR: {
    etiqueta: "Familia sin confirmar",
    explicacion: "Se parece a alguien del listado, pero no coinciden el nombre y todos los apellidos.",
  },
  NO_CUADRA: {
    etiqueta: "El importe no cuadra",
    explicacion: "No suma exactamente lo que debe la familia: puede ser un pago parcial o de más.",
  },
  VARIAS_COMBINACIONES: {
    etiqueta: "Varias opciones",
    explicacion: "El importe cuadra con más de una combinación de deudas de la familia.",
  },
  POSIBLE_YA_MARCADO: {
    etiqueta: "¿Ya marcado en el listado?",
    explicacion: "No cuadra con lo pendiente y la familia tiene pagos marcados en el listado: puede ser el mismo pago.",
  },
  DESHECHO: {
    etiqueta: "Deshecho",
    explicacion: "Estaba clasificado y alguien lo deshizo.",
  },
};
