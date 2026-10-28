import { z } from "zod";

const MAX_IMPORTE = 10_000_000; // 100.000 €

const asignacionesSchema = z
  .array(z.object({ cargoId: z.string().min(1), importeCentimos: z.number().int().positive().max(MAX_IMPORTE) }))
  .max(60);

export const filtroSchema = z.object({ estado: z.enum(["DUDA", "CLASIFICADO", "OTRO_INGRESO"]).default("DUDA") });

// D-5, D-52: el reparto de una duda entre deudas de una familia, y si se recuerda a quien paga (D-1).
export const resolverSchema = z.object({
  familiaId: z.string().min(1, "Elige la familia"),
  asignaciones: asignacionesSchema,
  recordarPagador: z.boolean().default(false),
});

// D-49: nota corta opcional ("Subvención del ayuntamiento").
export const otroIngresoSchema = z.object({
  nota: z
    .string()
    .trim()
    .max(120, "Como mucho 120 caracteres")
    .optional()
    .transform((v) => v || null),
});

export const cruzarSchema = z.object({ movimientoId: z.string().min(1) });

// D-46: pago apuntado a mano (efectivo, Bizum a una cuenta personal...).
export const pagoManualSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  concepto: z.string().trim().min(2, "¿Quién ha pagado?").max(120),
  importeCentimos: z.number().int().positive("El importe tiene que ser mayor que 0").max(MAX_IMPORTE),
  medio: z.enum(["EFECTIVO", "BIZUM", "TRANSFERENCIA", "OTRO"]),
  familiaId: z.string().min(1, "Elige la familia"),
  asignaciones: asignacionesSchema,
});

export const aplicarSaldoSchema = z.object({ cargoId: z.string().min(1) });
