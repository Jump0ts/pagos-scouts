import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { authApi } from "./auth.api";
import type { Perfil } from "./auth.types";

export const CLAVE_SESION = ["sesion"] as const;

export const useSesion = () =>
  useQuery({ queryKey: CLAVE_SESION, queryFn: authApi.yo, staleTime: 60_000 });

// Para pantallas que solo se ven con sesion (dentro de RutaProtegida): el perfil ya esta cargado.
export const usePerfil = () => {
  const { data } = useSesion();
  if (!data) throw new Error("usePerfil fuera de una ruta protegida");
  return data;
};

// Al entrar, cambiar de grupo o salir, todo lo cargado de antes deja de valer (puede ser de otro grupo).
export const useEstablecerSesion = () => {
  const queryClient = useQueryClient();
  return (perfil: Perfil | null) => {
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== CLAVE_SESION[0] });
    queryClient.setQueryData(CLAVE_SESION, perfil);
  };
};

export const useCerrarSesion = () => {
  const establecer = useEstablecerSesion();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      establecer(null);
      navigate("/login", { replace: true });
    },
  });
};

export const useCambiarGrupo = () => {
  const establecer = useEstablecerSesion();
  return useMutation({ mutationFn: authApi.cambiarGrupo, onSuccess: establecer });
};
