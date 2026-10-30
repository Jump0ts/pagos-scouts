import type { Seccion } from "@/features/secciones/secciones.types";

export type Curso = { id: string; nombre: string; activo: boolean };

// D-79, D-80: por que se propone lo que se propone a cada niño.
export type MotivoPaso = "SIGUE" | "SUBE" | "TERMINA" | "SIN_FECHA";

export type FilaPaso = {
  educandoId: string;
  nombre: string;
  apellidos: string;
  seccionActualId: string;
  // La que cumple en el año en que empieza el curso nuevo; null sin fecha de nacimiento.
  edad: number | null;
  propuesta: { seccionId: string | null; motivo: MotivoPaso };
};

export type PropuestaPaso = {
  origen: { id: string; nombre: string };
  destino: string;
  destinoExiste: boolean;
  secciones: Seccion[];
  filas: FilaPaso[];
};
