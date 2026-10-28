import { z } from "zod";

const centimos = z
  .number({ invalid_type_error: "Escribe un importe" })
  .int("Importe no válido")
  .min(0, "El importe no puede ser negativo")
  .max(10_000_000, "Importe demasiado alto");

const fecha = z
  .string({ required_error: "Elige una fecha" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .refine((f) => !Number.isNaN(Date.parse(f)), "Fecha no válida");

const precios = z
  .array(z.object({ seccionId: z.string().min(1), importeCentimos: centimos }))
  .min(1, "Elige al menos una sección")
  .refine((p) => new Set(p.map((x) => x.seccionId)).size === p.length, "Una sección aparece dos veces");

const nombre = z
  .string({ required_error: "Escribe un nombre" })
  .trim()
  .min(2, "El nombre es demasiado corto")
  .max(80, "El nombre es demasiado largo");

const FIN_ANTES_DE_INICIO = { path: ["fechaFin"], message: "La fecha de fin no puede ser anterior al inicio" };
const FALTA_SEGUNDO = { path: ["precioSegundoCentimos"], message: "Indica el precio del 2º hermano" };

export const crearEventoSchema = z
  .object({
    nombre,
    tipo: z.enum(["TODA_SECCION", "CON_APUNTADOS"], { errorMap: () => ({ message: "Elige el tipo de evento" }) }),
    fechaInicio: fecha,
    fechaFin: fecha,
    precios,
    descuentoHermanos: z.boolean().default(false),
    precioSegundoCentimos: centimos.nullable().default(null),
    precioTerceroCentimos: centimos.nullable().default(null),
    apuntados: z.array(z.string().min(1)).default([]),
  })
  .refine((d) => d.fechaFin >= d.fechaInicio, FIN_ANTES_DE_INICIO)
  .refine((d) => !d.descuentoHermanos || d.precioSegundoCentimos !== null, FALTA_SEGUNDO);

// Al editar, las comprobaciones que dependen de lo ya guardado se hacen en la ruta.
export const editarEventoSchema = z
  .object({
    nombre,
    fechaInicio: fecha,
    fechaFin: fecha,
    precios,
    descuentoHermanos: z.boolean(),
    precioSegundoCentimos: centimos.nullable(),
    precioTerceroCentimos: centimos.nullable(),
  })
  .partial()
  .refine((d) => !d.fechaInicio || !d.fechaFin || d.fechaFin >= d.fechaInicio, FIN_ANTES_DE_INICIO);

export const ajustarCargoSchema = z.object({
  importeAjustadoCentimos: centimos.nullable(),
  motivo: z.string().trim().max(200, "El motivo es demasiado largo").nullable().optional(),
});

export const anadirNinosSchema = z.object({ educandoIds: z.array(z.string().min(1)).min(1, "Elige al menos un niño") });

// D-54: los mismos filtros que en pantalla.
export const exportarSchema = z.object({
  estado: z.enum(["PENDIENTE", "PARCIAL", "PAGADO", "EXENTO"]).optional(),
  seccionId: z.string().min(1).optional(),
});
