import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/utils/api";
import type { Curso, PropuestaPaso } from "./cursos.types";

export const CLAVE_CURSOS = ["cursos"] as const;

export const useCursos = () =>
  useQuery({ queryKey: CLAVE_CURSOS, queryFn: () => api<{ cursos: Curso[]; sugerido: string }>("/cursos") });

// D-81: la propuesta se pide siempre de nuevo; nada se guarda hasta confirmar.
export const usePropuestaPaso = () =>
  useQuery({ queryKey: ["cursos", "paso"], queryFn: () => api<PropuestaPaso>("/cursos/paso"), staleTime: 0, gcTime: 0 });

export const usePasarDeCurso = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: { origenId: string; filas: { educandoId: string; seccionId: string | null }[] }) =>
      api<{ curso: Curso; siguen: number; terminan: number }>("/cursos/paso", { metodo: "POST", cuerpo: datos }),
    // Cambia el curso activo: todo lo que se ve (niños, eventos, Inicio) es de otro curso.
    onSuccess: () => queryClient.invalidateQueries(),
  });
};
