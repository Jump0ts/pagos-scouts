import { z } from "zod";
import { responsablesSchema } from "../familias/familias.schema.js";

const nombre = z.string({ required_error: "Escribe el nombre" }).trim().min(1, "Escribe el nombre").max(60, "El nombre es demasiado largo");
const apellidos = z.string().trim().max(80, "Los apellidos son demasiado largos").default("");
const fechaNacimiento = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .refine((f) => !Number.isNaN(Date.parse(f)) && new Date(f) <= new Date(), "Fecha no válida")
  .nullable()
  .optional();

// A que familia va: una existente o una nueva con sus responsables.
const familia = z.union([
  z.object({ id: z.string().min(1) }),
  z.object({ nueva: z.object({ responsables: responsablesSchema.default([]) }) }),
]);

export const crearEducandoSchema = z.object({
  nombre,
  apellidos,
  fechaNacimiento,
  seccionId: z.string({ required_error: "Elige una sección" }).min(1, "Elige una sección"),
  familia,
});

export const editarEducandoSchema = z
  .object({ nombre, apellidos, fechaNacimiento, seccionId: z.string().min(1), familia })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "No hay nada que cambiar" });
