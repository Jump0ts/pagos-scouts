import { tooManyRequests } from "./errors.js";

// Limite de peticiones por clave (normalmente la IP) en una ventana de tiempo. En memoria, como los intentos de
// entrar (D-14): la API corre en un solo proceso y, si se reinicia, lo peor que pasa es que el contador vuelve a cero.
// El nginx del servidor pone otro limite delante (D-69).

const MAX_CLAVES = 10_000;

export type Limite = { comprobar: (clave: string, ahora?: number) => void; reiniciar: () => void };

const limites: Limite[] = [];

export const crearLimite = ({ max, ventanaMs, mensaje }: { max: number; ventanaMs: number; mensaje: string }): Limite => {
  const usos = new Map<string, number[]>();

  const comprobar = (clave: string, ahora = Date.now()) => {
    const recientes = (usos.get(clave) ?? []).filter((t) => t > ahora - ventanaMs);
    if (recientes.length >= max) {
      usos.set(clave, recientes);
      throw tooManyRequests(mensaje);
    }
    recientes.push(ahora);
    usos.set(clave, recientes);

    // Que un ataque con muchas IPs no haga crecer la memoria sin fin: se tiran las claves sin usos recientes.
    if (usos.size > MAX_CLAVES) {
      for (const [k, v] of usos) if (!v.some((t) => t > ahora - ventanaMs)) usos.delete(k);
    }
  };

  const limite = { comprobar, reiniciar: () => usos.clear() };
  limites.push(limite);
  return limite;
};

// Solo para los tests.
export const reiniciarLimites = () => limites.forEach((l) => l.reiniciar());
