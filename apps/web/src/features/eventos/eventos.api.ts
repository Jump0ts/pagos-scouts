import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/utils/api";
import type { DatosEvento, DetalleEvento, EventoConResumen, TipoEvento } from "./eventos.types";

export const CLAVE_EVENTOS = ["eventos"] as const;
const claveEvento = (id: string) => ["evento", id] as const;

export const useEventos = () =>
  useQuery({
    queryKey: CLAVE_EVENTOS,
    queryFn: () => api<{ curso: { id: string; nombre: string } | null; eventos: EventoConResumen[] }>("/eventos"),
  });

export const useEvento = (id: string) =>
  useQuery({ queryKey: claveEvento(id), queryFn: () => api<DetalleEvento>(`/eventos/${id}`), enabled: Boolean(id) });

const useRefrescar = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CLAVE_EVENTOS }),
      queryClient.invalidateQueries({ queryKey: ["evento"] }),
    ]);
};

export const useCrearEvento = () =>
  useMutation({
    mutationFn: (datos: DatosEvento & { tipo: TipoEvento; apuntados: string[] }) =>
      api<{ evento: { id: string } }>("/eventos", { metodo: "POST", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useEditarEvento = () =>
  useMutation({
    mutationFn: ({ id, ...datos }: Partial<DatosEvento> & { id: string }) =>
      api<{ evento: { id: string }; recalculados: number; sinCambiar: number }>(`/eventos/${id}`, { metodo: "PATCH", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useBorrarEvento = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/eventos/${id}`, { metodo: "DELETE" }), onSuccess: useRefrescar() });

export const useAnadirNinos = () =>
  useMutation({
    mutationFn: ({ id, educandoIds }: { id: string; educandoIds: string[] }) =>
      api<void>(`/eventos/${id}/ninos`, { metodo: "POST", cuerpo: { educandoIds } }),
    onSuccess: useRefrescar(),
  });

export const useAjustarCargo = () =>
  useMutation({
    mutationFn: ({ eventoId, cargoId, ...datos }: { eventoId: string; cargoId: string; importeAjustadoCentimos: number | null; motivo?: string | null }) =>
      api<void>(`/eventos/${eventoId}/cargos/${cargoId}`, { metodo: "PATCH", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useQuitarCargo = () =>
  useMutation({
    mutationFn: ({ eventoId, cargoId }: { eventoId: string; cargoId: string }) =>
      api<void>(`/eventos/${eventoId}/cargos/${cargoId}`, { metodo: "DELETE" }),
    onSuccess: useRefrescar(),
  });
