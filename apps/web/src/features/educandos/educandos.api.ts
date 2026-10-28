import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/utils/api";
import type { DestinoFamilia, FichaFamilia, ListaEducandos } from "./educandos.types";

export const CLAVE_EDUCANDOS = ["educandos"] as const;
export const claveFamilia = (id: string) => ["familia", id] as const;

export const useEducandos = () => useQuery({ queryKey: CLAVE_EDUCANDOS, queryFn: () => api<ListaEducandos>("/educandos") });

export const useFichaFamilia = (id: string | null) =>
  useQuery({
    queryKey: claveFamilia(id ?? ""),
    queryFn: () => api<{ familia: FichaFamilia }>(`/familias/${id}`).then((r) => r.familia),
    enabled: Boolean(id),
  });

// Cualquier cambio en niños o familias puede afectar a la lista y a las fichas abiertas.
const useRefrescar = () => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CLAVE_EDUCANDOS }),
      queryClient.invalidateQueries({ queryKey: ["familia"] }),
    ]);
};

export type DatosEducando = {
  nombre: string;
  apellidos: string;
  fechaNacimiento: string | null;
  seccionId: string;
  familia: DestinoFamilia;
};

export const useCrearEducando = () =>
  useMutation({
    mutationFn: (datos: DatosEducando) =>
      api<{ educando: { id: string; familiaId: string } }>("/educandos", { metodo: "POST", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useEditarEducando = () =>
  useMutation({
    mutationFn: ({ id, ...datos }: Partial<DatosEducando> & { id: string }) =>
      api<{ educando: { id: string; familiaId: string } }>(`/educandos/${id}`, { metodo: "PATCH", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useCambiarBaja = () =>
  useMutation({
    mutationFn: ({ id, baja }: { id: string; baja: boolean }) =>
      api<void>(`/educandos/${id}/baja`, { metodo: baja ? "POST" : "DELETE" }),
    onSuccess: useRefrescar(),
  });

export const useBorrarEducando = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/educandos/${id}`, { metodo: "DELETE" }), onSuccess: useRefrescar() });

export const useEditarFamilia = () =>
  useMutation({
    mutationFn: ({ id, ...datos }: { id: string; nombre?: string; responsables?: string[] }) =>
      api<{ familia: FichaFamilia }>(`/familias/${id}`, { metodo: "PATCH", cuerpo: datos }),
    onSuccess: useRefrescar(),
  });

export const useBorrarFamilia = () =>
  useMutation({ mutationFn: (id: string) => api<void>(`/familias/${id}`, { metodo: "DELETE" }), onSuccess: useRefrescar() });

// D-48: aplicar el saldo a favor a una deuda cambia lo cobrado del evento y el sobrante de los pagos.
export const useAplicarSaldo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ familiaId, cargoId }: { familiaId: string; cargoId: string }) =>
      api<{ aplicadoCentimos: number }>(`/familias/${familiaId}/saldo/aplicar`, { metodo: "POST", cuerpo: { cargoId } }),
    onSuccess: () =>
      Promise.all([["familia"], ["eventos"], ["evento"], ["movimientos"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
};

// D-1: olvidar un nombre de quien paga aprendido para la familia.
export const useOlvidarPagador = () =>
  useMutation({
    mutationFn: ({ familiaId, pagadorId }: { familiaId: string; pagadorId: string }) =>
      api<void>(`/familias/${familiaId}/pagadores/${pagadorId}`, { metodo: "DELETE" }),
    onSuccess: useRefrescar(),
  });
