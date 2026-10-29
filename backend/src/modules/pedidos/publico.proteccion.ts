import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { crearLimite } from "../../utils/limite.js";

// D-69: protecciones del formulario publico, sin servicios de terceros.

// Justificante que firma la API al abrir el formulario: un envio tiene que traerlo, de este mismo pedido, con un
// tiempo minimo de relleno (un bot que envia al instante no pasa) y sin caducar. La clave vive solo en memoria: si
// la API se reinicia, quien tenga el formulario abierto solo tiene que recargar la pagina.
const CLAVE = randomBytes(32);
export const TIEMPO_MINIMO_MS = 4_000;
export const CADUCIDAD_MS = 12 * 60 * 60 * 1000;

const firma = (eventoId: string, emitido: number) => createHmac("sha256", CLAVE).update(`${eventoId}.${emitido}`).digest("base64url");

export const emitirTicket = (eventoId: string, ahora = Date.now()) => `${ahora}.${firma(eventoId, ahora)}`;

export type ProblemaTicket = "NO_VALIDO" | "DEMASIADO_RAPIDO" | "CADUCADO";

export const comprobarTicket = (ticket: string, eventoId: string, ahora = Date.now()): ProblemaTicket | null => {
  const [texto, recibida] = ticket.split(".");
  const emitido = Number(texto);
  if (!Number.isSafeInteger(emitido) || !recibida) return "NO_VALIDO";
  const esperada = Buffer.from(firma(eventoId, emitido));
  const dada = Buffer.from(recibida);
  if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return "NO_VALIDO";
  if (ahora - emitido < TIEMPO_MINIMO_MS) return "DEMASIADO_RAPIDO";
  if (ahora - emitido > CADUCIDAD_MS) return "CADUCADO";
  return null;
};

// Limites por IP. Abrir el formulario es barato y una familia puede recargarlo varias veces; enviar, poco: una
// familia con tres hijos manda tres envios.
export const limiteLectura = crearLimite({
  max: 60,
  ventanaMs: 10 * 60 * 1000,
  mensaje: "Demasiadas peticiones. Espera unos minutos y vuelve a intentarlo.",
});
export const limiteEnvio = crearLimite({
  max: 10,
  ventanaMs: 60 * 60 * 1000,
  mensaje: "Has enviado muchos pedidos seguidos. Espera un rato y vuelve a intentarlo.",
});

// Tope de envios pendientes de revisar por pedido: un ataque como mucho llena la bandeja hasta aqui.
export const MAX_PENDIENTES = 300;
