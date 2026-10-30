import { z } from "zod";

// D-66: el catalogo de un pedido. Los topes evitan catalogos (y formularios publicos) desmesurados.
export const MAX_ARTICULOS = 20;
export const MAX_OPCIONES = 5;
export const MAX_VALORES = 30;
export const MAX_UNIDADES = 20;
export const MAX_LONGITUD_TEXTO = 40;
// Un envio del formulario publico no puede traer mas lineas que esto, aunque el catalogo lo permitiera.
export const MAX_LINEAS_ENVIO = 30;

// Textos que escribe una familia (nombre a estampar) o que llegan a un Excel: solo letras, numeros, espacios y
// signos sencillos (tallas como "9/10" o "XL (adulto)"), y empezando por letra o numero. Asi nunca pueden ser una
// formula de Excel ni llevar codigo (D-70).
export const TEXTO_SEGURO = /^[\p{L}\p{N}][\p{L}\p{N} .,'’()/+-]*$/u;
// Nombres de personas: lo mismo, pero sin numeros.
export const NOMBRE_SEGURO = /^\p{L}[\p{L} .'’-]*$/u;

const centimos = z
  .number({ error: "Escribe un importe" })
  .int("Importe no válido")
  .min(0, "El importe no puede ser negativo")
  .max(1_000_000, "Importe demasiado alto");

const id = z.string().min(1).max(40);

const etiqueta = (min: number, max: number) =>
  z
    .string({ error: "Escribe un nombre" })
    .trim()
    .min(min, "Escribe un nombre")
    .max(max, "Demasiado largo")
    .regex(TEXTO_SEGURO, "Usa solo letras, números, espacios y signos sencillos");

const fecha = z
  .string({ error: "Elige una fecha" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")
  .refine((f) => !Number.isNaN(Date.parse(f)), "Fecha no válida");

const valorSchema = z.object({ id: id.optional(), valor: etiqueta(1, 30), suplementoCentimos: centimos.default(0) });

const opcionSchema = z
  .object({
    id: id.optional(),
    nombre: etiqueta(1, 40),
    tipo: z.enum(["LISTA", "TEXTO"], { error: "Elige el tipo de opción" }),
    obligatoria: z.boolean().default(true),
    maxLongitud: z.number().int().min(1).max(MAX_LONGITUD_TEXTO).nullable().default(null),
    suplementoCentimos: centimos.default(0),
    valores: z.array(valorSchema).max(MAX_VALORES, `Como mucho ${MAX_VALORES} valores`).default([]),
  })
  .superRefine((o, ctx) => {
    if (o.tipo === "LISTA" && o.valores.length === 0) {
      ctx.addIssue({ code: "custom", path: ["valores"], message: "Añade al menos un valor" });
    }
    if (o.tipo === "TEXTO" && o.maxLongitud === null) {
      ctx.addIssue({ code: "custom", path: ["maxLongitud"], message: "Indica cuántas letras como mucho" });
    }
    const valores = o.valores.map((v) => v.valor.toLocaleLowerCase("es"));
    if (new Set(valores).size !== valores.length) {
      ctx.addIssue({ code: "custom", path: ["valores"], message: "Hay un valor repetido" });
    }
  });

const articuloSchema = z.object({
  id: id.optional(),
  nombre: etiqueta(2, 60),
  precioCentimos: centimos,
  maxUnidades: z.number().int().min(1, "Al menos 1").max(MAX_UNIDADES, `Como mucho ${MAX_UNIDADES}`).default(5),
  opciones: z.array(opcionSchema).max(MAX_OPCIONES, `Como mucho ${MAX_OPCIONES} opciones`).default([]),
});

const articulos = z
  .array(articuloSchema)
  .min(1, "Añade al menos un artículo")
  .max(MAX_ARTICULOS, `Como mucho ${MAX_ARTICULOS} artículos`)
  .refine((a) => new Set(a.map((x) => x.nombre.toLocaleLowerCase("es"))).size === a.length, "Hay dos artículos con el mismo nombre");

const instrucciones = z.string().trim().max(500, "Como mucho 500 caracteres").nullable().default(null);

const FIN_ANTES_DE_INICIO = { path: ["fechaFin"], message: "La fecha de fin no puede ser anterior al inicio" };

export const crearPedidoSchema = z
  .object({
    nombre: z.string({ error: "Escribe un nombre" }).trim().min(2, "El nombre es demasiado corto").max(80, "El nombre es demasiado largo"),
    fechaInicio: fecha,
    fechaFin: fecha,
    instruccionesPago: instrucciones,
    articulos,
  })
  .refine((d) => d.fechaFin >= d.fechaInicio, FIN_ANTES_DE_INICIO);

export const editarPedidoSchema = z
  .object({
    nombre: z.string().trim().min(2, "El nombre es demasiado corto").max(80, "El nombre es demasiado largo"),
    fechaInicio: fecha,
    fechaFin: fecha,
    instruccionesPago: instrucciones,
    articulos,
  })
  .partial()
  .refine((d) => !d.fechaInicio || !d.fechaFin || d.fechaFin >= d.fechaInicio, FIN_ANTES_DE_INICIO);

export type CatalogoEntrada = z.infer<typeof articulos>;

// Lo que se elige para una unidad: un valor de cada lista y el texto de cada opcion de texto.
const eleccionSchema = z
  .object({ opcionId: id, valorId: id.optional(), texto: z.string().max(MAX_LONGITUD_TEXTO * 2).optional() })
  .strict();

export const lineaSchema = z
  .object({ articuloId: id, elecciones: z.array(eleccionSchema).max(MAX_OPCIONES) })
  .strict();

export type LineaEntrada = z.infer<typeof lineaSchema>;

export const anadirLineasSchema = z.object({
  educandoId: id,
  lineas: z.array(lineaSchema).min(1, "Añade al menos un artículo").max(MAX_LINEAS_ENVIO),
});

export const aceptarEnvioSchema = z.object({ educandoId: id, reemplazar: z.boolean().default(false) });

export const exportarPedidoSchema = z.object({ vista: z.enum(["personas", "proveedor"]).default("personas") });

const persona = (max: number) =>
  z
    .string({ error: "Escríbelo" })
    .trim()
    .min(1, "Escríbelo")
    .max(max, "Demasiado largo")
    .regex(NOMBRE_SEGURO, "Usa solo letras")
    .transform((s) => s.replace(/\s+/g, " "));

// D-67 y D-69: el formulario publico. strict: un campo que no esperamos es un envio que no viene de nuestra web.
export const envioPublicoSchema = z
  .object({
    enlace: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    ticket: z.string().max(200),
    // Campo trampa: invisible en la web; solo un bot lo rellena.
    web: z.string().max(200).default(""),
    nombre: persona(60),
    apellidos: persona(80),
    seccionId: id,
    lineas: z.array(lineaSchema).min(1, "Elige al menos un artículo").max(MAX_LINEAS_ENVIO, "Demasiados artículos"),
  })
  .strict();
