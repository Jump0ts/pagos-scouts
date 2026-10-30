// Calculo puro del paso de curso (D-79, D-80): a que seccion propone llevar a cada niño el curso que viene. Sin base de
// datos: lo usan la ruta y los tests.

export type SeccionPaso = { id: string; orden: number; edadMaxima: number | null; archivada: boolean };

/** Por que se propone lo que se propone: se queda, sube por edad, termina (no hay seccion para su edad) o le falta la fecha. */
export type MotivoPaso = "SIGUE" | "SUBE" | "TERMINA" | "SIN_FECHA";
export type Propuesta = { seccionId: string | null; motivo: MotivoPaso };

const anioInicio = (curso: string) => Number(curso.slice(0, 4));

/** "2026-27" → "2027-28". */
export const cursoSiguiente = (curso: string) => {
  const anio = anioInicio(curso) + 1;
  return `${anio}-${String((anio + 1) % 100).padStart(2, "0")}`;
};

/** D-79: la edad que cumple en el año natural en que empieza el curso (en 2027-28, la que cumple en 2027). */
export const edadEnCurso = (fechaNacimiento: Date | null, curso: string) =>
  fechaNacimiento ? anioInicio(curso) - fechaNacimiento.getUTCFullYear() : null;

export const proponerSeccion = (secciones: SeccionPaso[], seccionActualId: string, edad: number | null): Propuesta => {
  const actual = secciones.find((s) => s.id === seccionActualId);
  // Una seccion sin edad maxima (Scouters) no se deja por edad.
  if (!actual || actual.edadMaxima === null) return { seccionId: seccionActualId, motivo: "SIGUE" };
  if (edad === null) return { seccionId: seccionActualId, motivo: "SIN_FECHA" };
  if (edad <= actual.edadMaxima) return { seccionId: seccionActualId, motivo: "SIGUE" };

  // La primera seccion posterior en la que cabe por edad; si ya no cabe en ninguna, termina (D-80).
  const destino = secciones
    .filter((s) => !s.archivada && s.orden > actual.orden && s.edadMaxima !== null)
    .sort((a, b) => a.orden - b.orden)
    .find((s) => edad <= s.edadMaxima!);
  return destino ? { seccionId: destino.id, motivo: "SUBE" } : { seccionId: null, motivo: "TERMINA" };
};
