import { z } from "zod";

export const emailSchema = z
  .string({ error: "Escribe un email" })
  .trim()
  .toLowerCase()
  .max(254, "El email es demasiado largo")
  .email("No es un email válido");

// D-14: contrasenas largas antes que complicadas.
export const contrasenaNuevaSchema = z
  .string({ error: "Escribe una contraseña" })
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(128, "La contraseña no puede tener más de 128 caracteres");

export const nombreSchema = z
  .string({ error: "Escribe tu nombre" })
  .trim()
  .min(2, "El nombre es demasiado corto")
  .max(80, "El nombre es demasiado largo");

export const loginSchema = z.object({
  email: emailSchema,
  contrasena: z.string({ error: "Escribe tu contraseña" }).min(1, "Escribe tu contraseña").max(128),
});

export const cambiarContrasenaSchema = z.object({
  actual: z.string({ error: "Escribe tu contraseña actual" }).min(1, "Escribe tu contraseña actual").max(128),
  nueva: contrasenaNuevaSchema,
});

export const grupoActivoSchema = z.object({
  grupoId: z.string({ error: "Elige un grupo" }).min(1, "Elige un grupo"),
});
