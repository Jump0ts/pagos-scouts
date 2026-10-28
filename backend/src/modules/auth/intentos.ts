import { tooManyRequests } from "../../utils/errors.js";

// D-14: tras 5 intentos fallidos para un mismo email, 15 minutos de espera. En memoria: la API corre en un solo
// proceso, y si se reinicia lo peor que pasa es que el contador vuelve a cero.
export const MAX_FALLOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

type Registro = { fallos: number; bloqueadoHasta: number | null };
const registros = new Map<string, Registro>();

export const comprobarBloqueo = (email: string, ahora = Date.now()) => {
  const registro = registros.get(email);
  if (!registro?.bloqueadoHasta) return;
  if (registro.bloqueadoHasta <= ahora) {
    registros.delete(email);
    return;
  }
  const minutos = Math.ceil((registro.bloqueadoHasta - ahora) / 60_000);
  throw tooManyRequests(`Demasiados intentos fallidos. Prueba de nuevo dentro de ${minutos} min.`);
};

export const registrarFallo = (email: string, ahora = Date.now()) => {
  const registro = registros.get(email) ?? { fallos: 0, bloqueadoHasta: null };
  registro.fallos += 1;
  if (registro.fallos >= MAX_FALLOS) registro.bloqueadoHasta = ahora + BLOQUEO_MS;
  registros.set(email, registro);
};

export const registrarExito = (email: string) => {
  registros.delete(email);
};

// Solo para los tests.
export const reiniciarIntentos = () => registros.clear();
