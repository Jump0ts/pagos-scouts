import { ApiError } from "@/utils/api";
import type { FormularioPublico, LineaEntrada, ResumenEnvio } from "./pedidos.types";

// D-67: el formulario publico no tiene sesion. El codigo del enlace va detras del # y se manda en una cabecera o en
// el cuerpo, nunca en la URL de la peticion.
const RUTA = "/api/publico/pedido";

const pedir = async <T>(init: RequestInit): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(RUTA, { credentials: "omit", cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "No hay conexión. Comprueba tu conexión e inténtalo de nuevo.");
  }
  const datos = (await res.json().catch(() => null)) as { error?: string; campos?: Record<string, string> } | null;
  if (!res.ok) throw new ApiError(res.status, datos?.error ?? "Algo ha fallado. Inténtalo de nuevo.", datos?.campos);
  return datos as T;
};

export const codigoDelEnlace = () => window.location.hash.replace(/^#/, "");

export const leerFormulario = (codigo: string) =>
  pedir<FormularioPublico>({ headers: { Accept: "application/json", "X-Enlace-Pedido": codigo } });

export type EnvioPublico = {
  enlace: string;
  ticket: string;
  web: string;
  nombre: string;
  apellidos: string;
  seccionId: string;
  lineas: LineaEntrada[];
};

export const enviarPedido = (datos: EnvioPublico) =>
  pedir<ResumenEnvio>({
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
