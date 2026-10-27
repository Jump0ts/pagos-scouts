import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CLAVE_EVENTOS } from "@/features/eventos/eventos.api";
import { api } from "@/utils/api";
import type { AsignacionPedida, DetalleMovimiento, EstadoMovimiento, ListaMovimientos, MedioPago, ResumenImportacion } from "./movimientos.types";

export const CLAVE_MOVIMIENTOS = ["movimientos"] as const;

export const useMovimientos = (estado: EstadoMovimiento) =>
  useQuery({
    queryKey: [...CLAVE_MOVIMIENTOS, estado],
    queryFn: () => api<ListaMovimientos>(`/movimientos?estado=${estado}`),
  });

// Un pago cambia lo cobrado de los eventos y la ficha de la familia.
const useRefrescar = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [CLAVE_MOVIMIENTOS, CLAVE_EVENTOS, ["evento"], ["familia"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
};

// D-41: el mismo Excel se manda dos veces; la API lo lee en memoria y no lo guarda.
export const useAnalizarMovimientos = () =>
  useMutation({
    mutationFn: (archivo: File) => api<ResumenImportacion>("/movimientos/importar/analizar", { metodo: "POST", archivo }),
  });

export const useConfirmarMovimientos = () =>
  useMutation({
    mutationFn: (archivo: File) => api<ResumenImportacion>("/movimientos/importar/confirmar", { metodo: "POST", archivo }),
    onSuccess: useRefrescar(),
  });

export const useMovimiento = (id: string) =>
  useQuery({
    queryKey: [...CLAVE_MOVIMIENTOS, "detalle", id],
    queryFn: () => api<DetalleMovimiento>(`/movimientos/${id}`),
    enabled: Boolean(id),
  });

// D-5, D-52: el reparto de una duda entre deudas de una familia; con recordarPagador se aprende el nombre (D-1, D-50).
export const useResolverDuda = () =>
  useMutation({
    mutationFn: ({ id, ...datos }: { id: string; familiaId: string; asignaciones: AsignacionPedida[]; recordarPagador: boolean }) =>
      api<{ reintentadas: number }>(`/movimientos/${id}/resolver`, { metodo: "POST", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useOtroIngreso = () =>
  useMutation({
    mutationFn: ({ id, nota }: { id: string; nota: string }) => api<void>(`/movimientos/${id}/otro-ingreso`, { metodo: "POST", cuerpo: { nota } }),
    onSuccess: useRefrescar(),
  });

export const useCruzar = () =>
  useMutation({
    mutationFn: ({ id, movimientoId }: { id: string; movimientoId: string }) =>
      api<void>(`/movimientos/${id}/cruzar`, { metodo: "POST", cuerpo: { movimientoId } }),
    onSuccess: useRefrescar(),
  });

export type DatosPagoManual = {
  fecha: string;
  concepto: string;
  importeCentimos: number;
  medio: MedioPago;
  familiaId: string;
  asignaciones: AsignacionPedida[];
};

export const usePagoManual = () =>
  useMutation({
    mutationFn: (datos: DatosPagoManual) => api<{ movimiento: { id: string } }>("/movimientos", { metodo: "POST", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useDeshacerMovimiento = () =>
  useMutation({
    mutationFn: (id: string) => api<void>(`/movimientos/${id}/deshacer`, { metodo: "POST" }),
    onSuccess: useRefrescar(),
  });
