import type { Rol } from "@/features/auth/auth.types";

export type Miembro = {
  membresiaId: string;
  usuario: { id: string; nombre: string; email: string };
  rol: Rol;
  seccionIds: string[];
  esTuCuenta: boolean;
};

export type InvitacionPendiente = {
  id: string;
  email: string;
  rol: Rol;
  expiraEn: string;
  seccionIds: string[];
};

export type EnlaceGenerado = { enlace: string; expiraEn: string };
