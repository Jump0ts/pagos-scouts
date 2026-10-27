export type ColorSeccion = "castores" | "manada" | "tropa" | "unidad" | "clan" | "scouters";

export type Seccion = {
  id: string;
  nombre: string;
  orden: number;
  color: ColorSeccion;
  archivada: boolean;
};
