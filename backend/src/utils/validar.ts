import type { z } from "zod";
import { badRequest } from "./errors.js";

// Valida datos de entrada con un esquema de Zod; si no cumplen, responde 400 con el error de cada campo.
export const validar = <T extends z.ZodTypeAny>(esquema: T, datos: unknown): z.infer<T> => {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) return resultado.data;

  const campos: Record<string, string> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path.join(".") || "_";
    campos[campo] ??= issue.message;
  }
  throw badRequest("Revisa los datos enviados", campos);
};
