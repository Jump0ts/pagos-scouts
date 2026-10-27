// Los importes viajan y se guardan en céntimos (enteros); aquí se muestran y se leen en euros.
const formato = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export const euros = (centimos: number) => formato.format(centimos / 100);

/**
 * "85" -> 8500, "85,5" -> 8550, "1.234,56" -> 123456, "85.50" -> 8550. Devuelve null si no es un importe válido.
 * El punto se entiende como separador de miles solo si va seguido de 3 cifras.
 */
export const aCentimos = (texto: string): number | null => {
  const limpio = texto.trim().replace(/\s|€/g, "");
  if (!limpio) return null;
  const normalizado = limpio.includes(",")
    ? limpio.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(limpio)
      ? limpio.replace(/\./g, "")
      : limpio;
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  return Math.round(Number(normalizado) * 100);
};

// Para rellenar un campo de texto con un importe guardado: 8550 -> "85,50", 8500 -> "85".
export const aTextoEuros = (centimos: number | null | undefined) => {
  if (centimos === null || centimos === undefined) return "";
  return centimos % 100 === 0 ? String(centimos / 100) : (centimos / 100).toFixed(2).replace(".", ",");
};
