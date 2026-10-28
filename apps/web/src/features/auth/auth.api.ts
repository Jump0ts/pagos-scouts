import { api, ApiError } from "@/utils/api";
import type { InfoInvitacion, Perfil } from "./auth.types";

export const authApi = {
  // null si no hay sesion: no es un error, es "hay que iniciar sesion".
  yo: () =>
    api<Perfil>("/auth/yo").catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }),
  login: (email: string, contrasena: string) => api<Perfil>("/auth/login", { metodo: "POST", cuerpo: { email, contrasena } }),
  logout: () => api<void>("/auth/logout", { metodo: "POST" }),
  cambiarGrupo: (grupoId: string) => api<Perfil>("/auth/grupo-activo", { metodo: "PUT", cuerpo: { grupoId } }),
  cambiarContrasena: (actual: string, nueva: string) =>
    api<void>("/auth/contrasena", { metodo: "PUT", cuerpo: { actual, nueva } }),

  verInvitacion: (token: string) => api<InfoInvitacion>(`/invitaciones/${encodeURIComponent(token)}`),
  aceptarInvitacion: (token: string, datos: { nombre?: string; contrasena: string }) =>
    api<Perfil>(`/invitaciones/${encodeURIComponent(token)}/aceptar`, { metodo: "POST", cuerpo: datos }),

  verRestablecimiento: (token: string) => api<{ email: string }>(`/restablecer/${encodeURIComponent(token)}`),
  restablecer: (token: string, contrasena: string) =>
    api<void>(`/restablecer/${encodeURIComponent(token)}`, { metodo: "POST", cuerpo: { contrasena } }),
};
