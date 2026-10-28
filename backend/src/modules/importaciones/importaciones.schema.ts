import { z } from "zod";
import { nombreCompletoSchema } from "../familias/familias.schema.js";
import { FORMATO_CURSO } from "../cursos/cursos.utils.js";

// Lo que la web manda al confirmar el paso 3: la propuesta revisada, con la seccion de cada bloque.
export const confirmarListadoSchema = z.object({
  curso: z.string().regex(FORMATO_CURSO, "El curso debe tener la forma 2026-27"),
  secciones: z.record(z.string().regex(/^\d+$/), z.string().min(1)),
  familias: z
    .array(
      z.object({
        existenteId: z.string().min(1).nullable(),
        nombre: z.string().trim().min(2).max(80),
        responsables: z.array(nombreCompletoSchema).max(6),
        ninos: z
          .array(
            z.object({
              existenteId: z.string().min(1).nullable(),
              nombre: z.string().trim().min(1).max(60),
              apellidos: z.string().trim().max(80),
              bloque: z.number().int().min(0),
              pagado: z.array(z.string().max(120)).max(20).default([]),
            }),
          )
          .min(1),
      }),
    )
    .min(1, "No hay ningún niño que importar")
    .max(1500),
  // D-44: a que evento corresponde cada columna con marcas "Pagado" (las que no se mandan, no se importan).
  columnasPago: z
    .array(z.object({ clave: z.string().min(1).max(120), titulo: z.string().trim().min(1).max(120), eventoId: z.string().min(1) }))
    .max(20)
    .default([]),
});

export type ConfirmarListado = z.infer<typeof confirmarListadoSchema>;
