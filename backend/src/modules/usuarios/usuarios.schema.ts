import { Rol } from "@prisma/client";
import { z } from "zod";

export const editarMiembroSchema = z
  .object({
    rol: z.enum(Rol, { error: "Elige un rol" }),
    seccionIds: z.array(z.string().min(1)).default([]),
  })
  .refine((datos) => datos.rol !== "SCOUTER" || datos.seccionIds.length > 0, {
    path: ["seccionIds"],
    message: "Un scouter necesita al menos una sección",
  });
