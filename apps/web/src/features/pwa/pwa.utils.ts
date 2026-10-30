import { useSyncExternalStore } from "react";

// D-74: en que dispositivo estamos y si la app ya esta instalada, para dar los pasos que tocan.

type Plataforma = "ios" | "android" | "escritorio";

export const plataforma = (ua = navigator.userAgent): Plataforma =>
  // Los iPad modernos dicen ser un Mac, pero con pantalla tactil.
  /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    ? "ios"
    : /Android/i.test(ua)
      ? "android"
      : "escritorio";

export const estaInstalada = () =>
  window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as { standalone?: boolean }).standalone === true;

// El navegador ofrece instalarla (Chrome, Edge y Android) con este evento; se guarda para lanzarlo desde un boton.
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let pendiente: EventoInstalar | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());

/** Se llama una vez al arrancar: el evento llega muy pronto, antes de que se pinte ninguna pantalla. */
export const escucharInstalacion = () => {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pendiente = e as EventoInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    pendiente = null;
    avisar();
  });
};

const suscribir = (oyente: () => void) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

/** true si el navegador deja instalarla con un boton. */
export const usePuedeInstalar = () => useSyncExternalStore(suscribir, () => pendiente !== null, () => false);

export const instalar = async () => {
  if (!pendiente) return false;
  const evento = pendiente;
  await evento.prompt();
  const { outcome } = await evento.userChoice;
  pendiente = null;
  avisar();
  return outcome === "accepted";
};

// Preferencias de este navegador (la tarjeta cerrada). Puede no haber almacenamiento (modo privado): entonces no se
// recuerda, pero nada falla.
export const leerPreferencia = (clave: string) => {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
};

export const guardarPreferencia = (clave: string, valor: string) => {
  try {
    window.localStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
};

// D-72: sin conexion la app lo dice; los datos nunca se guardan en el movil.
const suscribirConexion = (oyente: () => void) => {
  window.addEventListener("online", oyente);
  window.addEventListener("offline", oyente);
  return () => {
    window.removeEventListener("online", oyente);
    window.removeEventListener("offline", oyente);
  };
};

export const useSinConexion = () => useSyncExternalStore(suscribirConexion, () => !navigator.onLine, () => false);
