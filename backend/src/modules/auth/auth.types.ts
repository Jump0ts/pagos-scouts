import type { Rol } from "@prisma/client";

// Lo que la web sabe de quien ha iniciado sesion (GET /api/auth/yo).
export type Perfil = {
  usuario: { id: string; nombre: string; email: string };
  grupos: { id: string; nombre: string; rol: Rol }[];
  grupoActivo: { id: string; nombre: string; rol: Rol; seccionIds: string[] } | null;
};
