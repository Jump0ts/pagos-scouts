import { z } from "zod";

export const nombreCompletoSchema = z
  .string()
  .trim()
  .min(2, "El nombre es demasiado corto")
  .max(120, "El nombre es demasiado largo");

// D-27: de los responsables solo el nombre completo. Una familia puede no tener ninguno apuntado.
export const responsablesSchema = z.array(nombreCompletoSchema).max(6, "Como máximo 6 responsables");

export const editarFamiliaSchema = z
  .object({
    nombre: z.string().trim().min(2, "El nombre es demasiado corto").max(80, "El nombre es demasiado largo"),
    responsables: responsablesSchema,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "No hay nada que cambiar" });
