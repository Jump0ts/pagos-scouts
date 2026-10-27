import { Rol } from "@prisma/client";
import { z } from "zod";
import { emailSchema, nombreSchema } from "../auth/auth.schema.js";

export const crearInvitacionSchema = z
  .object({
    email: emailSchema,
    rol: z.nativeEnum(Rol, { errorMap: () => ({ message: "Elige un rol" }) }),
    seccionIds: z.array(z.string().min(1)).default([]),
  })
  .refine((datos) => datos.rol !== "SCOUTER" || datos.seccionIds.length > 0, {
    path: ["seccionIds"],
    message: "Un scouter necesita al menos una seccion",
  });

// Si el email ya tiene cuenta, basta con su contrasena actual; si no, nombre y contrasena nueva.
export const aceptarInvitacionSchema = z.object({
  nombre: nombreSchema.optional(),
  contrasena: z.string({ required_error: "Escribe una contrasena" }).min(1, "Escribe una contrasena").max(128),
});
