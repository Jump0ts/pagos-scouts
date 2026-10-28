// Mismo formato que la API (backend/src/modules/importaciones/importaciones.types.ts).
export type NinoPropuesto = {
  clave: string;
  bloque: number;
  nombre: string;
  apellidos: string;
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
  avisos: string[];
};

export type AnalisisListado = {
  bloques: { indice: number; total: number; ejemplos: string[] }[];
  familias: FamiliaPropuesta[];
  columnasIgnoradas: string[];
  columnasPago: { clave: string; titulo: string; marcas: number }[];
  noAparecen: { id: string; nombre: string; seccionId: string }[];
  cursoSugerido: string;
};

export type ResultadoImportacion = {
  curso: { id: string; nombre: string };
  familiasNuevas: number;
  ninosNuevos: number;
  ninosActualizados: number;
  marcasImportadas: number;
  marcasSinCargo: number;
  marcasYaPagadas: number;
};
