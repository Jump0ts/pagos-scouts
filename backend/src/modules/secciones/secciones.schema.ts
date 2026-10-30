import { z } from "zod";
import { COLORES_SECCION } from "./secciones.constants.js";

const nombreSeccion = z
  .string({ error: "Escribe un nombre" })
  .trim()
  .min(2, "El nombre es demasiado corto")
  .max(40, "El nombre es demasiado largo");

const colorSeccion = z.enum(COLORES_SECCION, { error: "Elige un color de la lista" });

// D-79: hasta que edad se esta en la seccion; vacia (null) en las que no se sale por edad, como Scouters.
const edadMaxima = z
  .number({ error: "Escribe una edad" })
  .int("Escribe una edad sin decimales")
  .min(3, "Escribe una edad de 3 años o más")
  .max(99, "Escribe una edad de menos de 100 años")
  .nullable();

export const crearSeccionSchema = z.object({ nombre: nombreSeccion, color: colorSeccion, edadMaxima: edadMaxima.optional() });

export const editarSeccionSchema = z
  .object({ nombre: nombreSeccion, color: colorSeccion, edadMaxima, archivada: z.boolean() })
  .partial()
  .refine((datos) => Object.keys(datos).length > 0, { message: "No hay nada que cambiar" });

export const ordenSeccionesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Indica el orden de las secciones"),
});
