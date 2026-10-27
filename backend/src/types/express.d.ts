import type { Rol } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      // Lo rellena cargarSesion si la cookie de sesion es valida.
      sesion?: {
        id: string;
        usuario: { id: string; nombre: string; email: string };
        grupoActivoId: string | null;
      };
      // Lo rellena requiereGrupo: el grupo con el que se trabaja y el papel del usuario en el.
      grupo?: {
        id: string;
        membresiaId: string;
        rol: Rol;
        seccionIds: string[];
      };
    }
  }
}

export {};
