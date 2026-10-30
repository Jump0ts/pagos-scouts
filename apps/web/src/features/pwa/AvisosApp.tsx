import { RefreshCw, WifiOff, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Boton } from "@/components/Boton";
import { useSinConexion } from "./pwa.utils";

const UNA_HORA = 60 * 60 * 1000;

// D-73: hay una version nueva. Nunca se recarga sola: la persona decide cuando, para no cortar lo que esta haciendo.
const AvisoVersion = () => {
  const {
    needRefresh: [nueva, setNueva],
    updateServiceWorker,
  } = useRegisterSW({
    // Quien deja la app abierta todo el dia tambien se entera: se mira cada hora si hay version nueva.
    onRegisteredSW: (_url, registro) => {
      if (registro) setInterval(() => void registro.update(), UNA_HORA);
    },
  });
  if (!nueva) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-tinta p-3 pl-4 text-fondo shadow-2xl md:bottom-6"
    >
      <RefreshCw className="size-5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm font-semibold">Hay una versión nueva de la app.</p>
      <Boton tamano="pequeno" className="bg-fondo text-tinta" onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </Boton>
      <button
        type="button"
        onClick={() => setNueva(false)}
        aria-label="Ahora no"
        className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-fondo/15"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
};

// D-72: sin conexion la app abre, pero no puede cargar ni guardar datos; se dice claro.
const AvisoSinConexion = () => {
  const sinConexion = useSinConexion();
  if (!sinConexion) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-ambar-claro px-4 py-2 text-center text-sm font-semibold">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      Sin conexión: no se pueden cargar ni guardar datos hasta que vuelva.
    </div>
  );
};

export const AvisosApp = () => (
  <>
    <AvisoSinConexion />
    <AvisoVersion />
  </>
);
