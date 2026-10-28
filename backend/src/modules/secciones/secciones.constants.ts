// D-3: con las que empieza todo grupo nuevo, de menor a mayor edad.
export const SECCIONES_POR_DEFECTO = [
  { nombre: "Castores", color: "castores" },
  { nombre: "Manada", color: "manada" },
  { nombre: "Tropa", color: "tropa" },
  { nombre: "Unidad", color: "unidad" },
  { nombre: "Clan", color: "clan" },
  { nombre: "Scouters", color: "scouters" },
] as const;

// Colores que la web sabe pintar (tokens del tema).
export const COLORES_SECCION = ["castores", "manada", "tropa", "unidad", "clan", "scouters"] as const;
