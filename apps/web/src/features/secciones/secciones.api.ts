import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/utils/api";
import type { ColorSeccion, Seccion } from "./secciones.types";

export const CLAVE_SECCIONES = ["secciones"] as const;

export const useSecciones = () =>
  useQuery({
    queryKey: CLAVE_SECCIONES,
    queryFn: () => api<{ secciones: Seccion[] }>("/secciones").then((r) => r.secciones),
  });

const useAlCambiar = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CLAVE_SECCIONES });
};

export const useCrearSeccion = () =>
  useMutation({
    mutationFn: (datos: { nombre: string; color: ColorSeccion; edadMaxima: number | null }) => api("/secciones", { metodo: "POST", cuerpo: datos }),
    onSuccess: useAlCambiar(),
  });

export const useEditarSeccion = () =>
  useMutation({
    mutationFn: ({ id, ...datos }: { id: string; nombre?: string; color?: ColorSeccion; edadMaxima?: number | null; archivada?: boolean }) =>
      api(`/secciones/${id}`, { metodo: "PATCH", cuerpo: datos }),
    onSuccess: useAlCambiar(),
  });

export const useOrdenarSecciones = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api<{ secciones: Seccion[] }>("/secciones/orden", { metodo: "PUT", cuerpo: { ids } }).then((r) => r.secciones),
    // El nuevo orden se ve al instante; si la API falla, se vuelve a pedir el de verdad.
    onMutate: (ids) => {
      const actuales = queryClient.getQueryData<Seccion[]>(CLAVE_SECCIONES) ?? [];
      queryClient.setQueryData(
        CLAVE_SECCIONES,
        ids.map((id, orden) => ({ ...actuales.find((s) => s.id === id)!, orden })),
      );
    },
    onSuccess: (secciones) => queryClient.setQueryData(CLAVE_SECCIONES, secciones),
    onError: () => queryClient.invalidateQueries({ queryKey: CLAVE_SECCIONES }),
  });
};
