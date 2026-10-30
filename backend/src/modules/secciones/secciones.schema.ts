import { z } from "zod";
import { COLORES_SECCION } from "./secciones.constants.js";

const nombreSeccion = z
  .string({ error: "Escribe un nombre" })
  .trim()
  .min(2, "El nombre es demasiado corto")
  .max(40, "El nombre es demasiado largo");

const colorSeccion = z.enum(COLORES_SECCION, { error: "Elige un color de la lista" });

export const crearSeccionSchema = z.object({ nombre: nombreSeccion, color: colorSeccion });

export const editarSeccionSchema = z
  .object({ nombre: nombreSeccion, color: colorSeccion, archivada: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, { message: "No hay nada que cambiar" });

export const ordenSeccionesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Indica el orden de las secciones"),
});
