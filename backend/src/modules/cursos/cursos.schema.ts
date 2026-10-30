import { z } from "zod";

// D-81: lo que se confirma en el paso de curso. Una fila por cada niño del curso activo; sin seccion, no sigue (D-80).
export const pasoCursoSchema = z.object({
  // El curso del que se parte: si mientras tanto alguien ya hizo el paso, no se hace dos veces.
  origenId: z.string().min(1),
  filas: z
    .array(z.object({ educandoId: z.string().min(1), seccionId: z.string().min(1).nullable() }))
    .max(5000, "Demasiados niños en un solo paso"),
});
