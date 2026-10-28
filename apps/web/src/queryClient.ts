import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { CLAVE_SESION } from "./features/auth/useSesion";
import { ApiError } from "./utils/api";

// Si cualquier peticion dice que la sesion ya no vale (401) o que el grupo ya no es tuyo (403 de grupo), se
// vuelve a mirar quien eres: la web te lleva al login o a elegir grupo sin quedarse en una pantalla rota.
const alFallar = (error: unknown) => {
  if (!(error instanceof ApiError)) return;
  if (error.status === 401) queryClient.setQueryData(CLAVE_SESION, null);
  if (error.status === 403 && error.message === "Elige un grupo para continuar") {
    void queryClient.invalidateQueries({ queryKey: CLAVE_SESION });
  }
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: alFallar }),
  mutationCache: new MutationCache({ onError: alFallar }),
  defaultOptions: {
    queries: {
      // Los errores 4xx no se arreglan reintentando.
      retry: (intentos, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && intentos < 2,
      refetchOnWindowFocus: true,
    },
  },
});
