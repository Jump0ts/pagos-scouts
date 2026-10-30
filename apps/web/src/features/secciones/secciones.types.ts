export type ColorSeccion = "castores" | "manada" | "tropa" | "unidad" | "clan" | "scouters";

export type Seccion = {
  id: string;
  nombre: string;
  orden: number;
  color: ColorSeccion;
  // D-79: hasta que edad se esta en ella; null en las que no se sale por edad (Scouters).
  edadMaxima: number | null;
  archivada: boolean;
};
