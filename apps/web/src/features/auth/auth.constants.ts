import type { Rol } from "./auth.types";

export const ROLES: { valor: Rol; etiqueta: string; descripcion: string }[] = [
  { valor: "ADMIN", etiqueta: "Administración", descripcion: "Todo, incluidas las personas y los ajustes del grupo." },
  { valor: "TESORERIA", etiqueta: "Tesorería", descripcion: "Pagos, eventos, educandos y Dudas. No gestiona personas." },
  { valor: "SCOUTER", etiqueta: "Scouter", descripcion: "Solo consulta quién ha pagado en sus secciones." },
];

export const ETIQUETA_ROL = Object.fromEntries(ROLES.map((r) => [r.valor, r.etiqueta])) as Record<Rol, string>;
