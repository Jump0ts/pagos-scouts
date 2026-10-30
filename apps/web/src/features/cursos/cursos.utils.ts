/** "2026-27" → "2027-28". */
export const cursoSiguiente = (curso: string) => {
  const anio = Number(curso.slice(0, 4)) + 1;
  return `${anio}-${String((anio + 1) % 100).padStart(2, "0")}`;
};
