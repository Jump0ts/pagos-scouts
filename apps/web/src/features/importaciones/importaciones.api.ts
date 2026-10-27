import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CLAVE_EDUCANDOS } from "@/features/educandos/educandos.api";
import { CLAVE_EVENTOS } from "@/features/eventos/eventos.api";
import { CLAVE_MOVIMIENTOS } from "@/features/movimientos/movimientos.api";
import { api } from "@/utils/api";
import type { AnalisisListado, ResultadoImportacion } from "./importaciones.types";

// Pasos 1-2: el fichero viaja tal cual; la API lo lee en memoria y devuelve la propuesta sin guardar nada.
export const useAnalizarListado = () =>
  useMutation({
    mutationFn: (archivo: File) => api<AnalisisListado>("/importaciones/listado/analizar", { metodo: "POST", archivo }),
  });

export type ConfirmacionListado = {
  curso: string;
  secciones: Record<string, string>;
  familias: {
    existenteId: string | null;
    nombre: string;
    responsables: string[];
    ninos: { existenteId: string | null; nombre: string; apellidos: string; bloque: number; pagado: string[] }[];
  }[];
  // D-44: el evento de cada columna con marcas "Pagado" que se quiere importar.
  columnasPago: { clave: string; titulo: string; eventoId: string }[];
};

export const useConfirmarListado = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: ConfirmacionListado) =>
      api<ResultadoImportacion>("/importaciones/listado/confirmar", { metodo: "POST", cuerpo: datos }),
    onSuccess: () =>
      Promise.all([CLAVE_EDUCANDOS, CLAVE_EVENTOS, CLAVE_MOVIMIENTOS, ["evento"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
};
