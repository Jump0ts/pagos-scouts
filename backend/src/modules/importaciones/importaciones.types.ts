import type { ColumnaPago } from "./listado.parser.js";

// Propuesta que se revisa en el paso 3 del asistente (D-28). Nada de esto esta guardado todavia.
export type NinoPropuesto = {
  clave: string;
  bloque: number;
  nombre: string;
  apellidos: string;
  // Si ya existe en el grupo (reimportacion, D-29).
  existenteId: string | null;
  seccionActualId: string | null;
  // Columnas en las que tiene la marca "Pagado" (D-44).
  pagado: string[];
};

export type FamiliaPropuesta = {
  clave: string;
  nombre: string;
  responsables: string[];
  existenteId: string | null;
  ninos: NinoPropuesto[];
  // Lo que conviene revisar: uniones por erratas, sin responsables, duplicados...
  avisos: string[];
};

export type AnalisisListado = {
  bloques: { indice: number; total: number; ejemplos: string[] }[];
  familias: FamiliaPropuesta[];
  columnasIgnoradas: string[];
  // D-44: columnas con marcas "Pagado", para ligarlas a un evento.
  columnasPago: ColumnaPago[];
  // Niños del curso activo que no aparecen en el listado (posibles bajas; no se dan de baja solos).
  noAparecen: { id: string; nombre: string; seccionId: string }[];
  cursoSugerido: string;
};
