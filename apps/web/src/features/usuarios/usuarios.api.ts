import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Rol } from "@/features/auth/auth.types";
import { CLAVE_SESION } from "@/features/auth/useSesion";
import { api } from "@/utils/api";
import type { EnlaceGenerado, InvitacionPendiente, Miembro } from "./usuarios.types";

export const CLAVE_USUARIOS = ["usuarios"] as const;

export const useUsuarios = () =>
  useQuery({
    queryKey: CLAVE_USUARIOS,
    queryFn: () => api<{ miembros: Miembro[]; invitaciones: InvitacionPendiente[] }>("/usuarios"),
  });

const useRefrescar = () => {
  const queryClient = useQueryClient();
  // Cambiar tu propio rol cambia lo que puedes ver: tambien se recarga la sesion.
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CLAVE_USUARIOS }),
      queryClient.invalidateQueries({ queryKey: CLAVE_SESION }),
    ]);
};

export const useInvitar = () =>
  useMutation({
    mutationFn: (datos: { email: string; rol: Rol; seccionIds: string[] }) =>
      api<{ invitacion: InvitacionPendiente } & { enlace: string }>("/usuarios/invitaciones", { metodo: "POST", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useRetirarInvitacion = () =>
  useMutation({
    mutationFn: (id: string) => api<void>(`/usuarios/invitaciones/${id}`, { metodo: "DELETE" }),
    onSuccess: useRefrescar(),
  });

export const useEditarMiembro = () =>
  useMutation({
    mutationFn: ({ membresiaId, ...datos }: { membresiaId: string; rol: Rol; seccionIds: string[] }) =>
      api(`/usuarios/${membresiaId}`, { metodo: "PATCH", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useQuitarMiembro = () =>
  useMutation({
    mutationFn: (membresiaId: string) => api<void>(`/usuarios/${membresiaId}`, { metodo: "DELETE" }),
    onSuccess: useRefrescar(),
  });

export const useEnlaceRestablecer = () =>
  useMutation({
    mutationFn: (membresiaId: string) => api<EnlaceGenerado>(`/usuarios/${membresiaId}/restablecer`, { metodo: "POST" }),
  });
