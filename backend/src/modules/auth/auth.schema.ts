import { z } from "zod";

export const emailSchema = z
  .string({ required_error: "Escribe un email" })
  .trim()
  .toLowerCase()
  .max(254, "El email es demasiado largo")
  .email("No es un email valido");

// D-14: contrasenas largas antes que complicadas.
export const contrasenaNuevaSchema = z
  .string({ required_error: "Escribe una contrasena" })
  .min(10, "La contrasena debe tener al menos 10 caracteres")
  .max(128, "La contrasena no puede tener mas de 128 caracteres");

export const nombreSchema = z
  .string({ required_error: "Escribe tu nombre" })
  .trim()
  .min(2, "El nombre es demasiado corto")
  .max(80, "El nombre es demasiado largo");

export const loginSchema = z.object({
  email: emailSchema,
  contrasena: z.string({ required_error: "Escribe tu contrasena" }).min(1, "Escribe tu contrasena").max(128),
});

export const grupoActivoSchema = z.object({
  grupoId: z.string({ required_error: "Elige un grupo" }).min(1, "Elige un grupo"),
});
