import { z } from "zod";

// Mismas reglas que la API (backend/src/modules/auth/auth.schema.ts), para avisar antes de enviar.
const email = z.string().trim().min(1, "Escribe tu email").email("No es un email válido");
const contrasenaNueva = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(128, "La contraseña no puede tener más de 128 caracteres");

export const loginSchema = z.object({
  email,
  contrasena: z.string().min(1, "Escribe tu contraseña"),
});
export type LoginDatos = z.infer<typeof loginSchema>;

const contrasenas = z.object({ contrasena: contrasenaNueva, repetir: z.string() });
const coinciden = (d: z.infer<typeof contrasenas>) => d.contrasena === d.repetir;
const NO_COINCIDEN = { path: ["repetir"], message: "Las contraseñas no coinciden" };

export const cuentaNuevaSchema = contrasenas
  .extend({ nombre: z.string().trim().min(2, "El nombre es demasiado corto").max(80, "El nombre es demasiado largo") })
  .refine(coinciden, NO_COINCIDEN);
export type CuentaNuevaDatos = z.infer<typeof cuentaNuevaSchema>;

export const cuentaExistenteSchema = z.object({ contrasena: z.string().min(1, "Escribe tu contraseña") });
export type CuentaExistenteDatos = z.infer<typeof cuentaExistenteSchema>;

export const nuevaContrasenaSchema = contrasenas.refine(coinciden, NO_COINCIDEN);
export type NuevaContrasenaDatos = z.infer<typeof nuevaContrasenaSchema>;

export const cambiarContrasenaSchema = z
  .object({ actual: z.string().min(1, "Escribe tu contraseña actual"), nueva: contrasenaNueva, repetir: z.string() })
  .refine((d) => d.nueva === d.repetir, { path: ["repetir"], message: "Las contraseñas no coinciden" });
export type CambiarContrasenaDatos = z.infer<typeof cambiarContrasenaSchema>;
