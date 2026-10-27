import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CLAVE_EVENTOS } from "@/features/eventos/eventos.api";
import { api } from "@/utils/api";
import type { EstadoMovimiento, ListaMovimientos, ResumenImportacion } from "./movimientos.types";

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

export const useDeshacerMovimiento = () =>
  useMutation({
    mutationFn: (id: string) => api<void>(`/movimientos/${id}/deshacer`, { metodo: "POST" }),
    onSuccess: useRefrescar(),
  });
