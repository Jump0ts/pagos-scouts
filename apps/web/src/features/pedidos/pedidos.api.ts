import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CLAVE_EVENTOS } from "@/features/eventos/eventos.api";
import { api } from "@/utils/api";
import type { DatosPedido, DetallePedido, Envio, LineaEntrada } from "./pedidos.types";

export const usePedido = (id: string) =>
  useQuery({ queryKey: ["pedido", id], queryFn: () => api<DetallePedido>(`/pedidos/${id}`), enabled: Boolean(id) });

export const useEnvios = (id: string, activo = true) =>
  useQuery({
    queryKey: ["pedido", id, "envios"],
    queryFn: () => api<{ envios: Envio[] }>(`/pedidos/${id}/envios`),
    enabled: Boolean(id) && activo,
  });

const useRefrescar = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CLAVE_EVENTOS }),
      queryClient.invalidateQueries({ queryKey: ["pedido"] }),
      queryClient.invalidateQueries({ queryKey: ["evento"] }),
    ]);
};

export const useCrearPedido = () =>
  useMutation({
    mutationFn: (datos: DatosPedido) => api<{ pedido: { id: string } }>("/pedidos", { metodo: "POST", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useEditarPedido = () =>
  useMutation({
    mutationFn: ({ id, ...datos }: Partial<DatosPedido> & { id: string }) =>
      api<{ pedido: { id: string } }>(`/pedidos/${id}`, { metodo: "PATCH", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useCambiarEnlace = () =>
  useMutation({ mutationFn: (id: string) => api<{ enlace: string }>(`/pedidos/${id}/enlace`, { metodo: "POST" }), onSuccess: useRefrescar() });

export const useCerrarPedido = () =>
  useMutation({
    mutationFn: ({ id, cerrar }: { id: string; cerrar: boolean }) =>
      api<void>(`/pedidos/${id}/${cerrar ? "cerrar" : "reabrir"}`, { metodo: "POST" }),
    onSuccess: useRefrescar(),
  });

export const useAnadirLineas = () =>
  useMutation({
    mutationFn: ({ id, ...datos }: { id: string; educandoId: string; lineas: LineaEntrada[] }) =>
      api<{ totalCentimos: number }>(`/pedidos/${id}/lineas`, { metodo: "POST", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useQuitarLinea = () =>
  useMutation({
    mutationFn: ({ id, lineaId }: { id: string; lineaId: string }) => api<void>(`/pedidos/${id}/lineas/${lineaId}`, { metodo: "DELETE" }),
    onSuccess: useRefrescar(),
  });

export const useAceptarEnvio = () =>
  useMutation({
    mutationFn: ({ id, envioId, ...datos }: { id: string; envioId: string; educandoId: string; reemplazar: boolean }) =>
      api<void>(`/pedidos/${id}/envios/${envioId}/aceptar`, { metodo: "POST", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useRechazarEnvio = () =>
  useMutation({
    mutationFn: ({ id, envioId }: { id: string; envioId: string }) => api<void>(`/pedidos/${id}/envios/${envioId}`, { metodo: "DELETE" }),
    onSuccess: useRefrescar(),
  });
