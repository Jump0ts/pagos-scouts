// D-3: con las que empieza todo grupo nuevo, de menor a mayor edad, con su edad maxima (D-79).
export const SECCIONES_POR_DEFECTO = [
  { nombre: "Castores", color: "castores", edadMaxima: 7 },
  { nombre: "Manada", color: "manada", edadMaxima: 10 },
  { nombre: "Tropa", color: "tropa", edadMaxima: 13 },
  { nombre: "Unidad", color: "unidad", edadMaxima: 16 },
  { nombre: "Clan", color: "clan", edadMaxima: 21 },
  { nombre: "Scouters", color: "scouters", edadMaxima: null },
] as const;

// Colores que la web sabe pintar (tokens del tema).
export const COLORES_SECCION = ["castores", "manada", "tropa", "unidad", "clan", "scouters"] as const;
