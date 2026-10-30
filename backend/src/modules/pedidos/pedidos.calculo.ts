// Calculo puro de una linea de pedido (D-66): comprueba lo elegido contra el catalogo y calcula su importe. Sin base
// de datos: lo usan el formulario publico, el alta a mano y los tests.
import { TEXTO_SEGURO, type LineaEntrada } from "./pedidos.schema.js";

export type ValorCatalogo = { id: string; valor: string; suplementoCentimos: number };
export type OpcionCatalogo = {
  id: string;
  nombre: string;
  tipo: "LISTA" | "TEXTO";
  obligatoria: boolean;
  maxLongitud: number | null;
  suplementoCentimos: number;
  valores: ValorCatalogo[];
};
export type ArticuloCatalogo = { id: string; nombre: string; precioCentimos: number; maxUnidades: number; opciones: OpcionCatalogo[] };

// Como se guarda lo elegido: con los nombres de ese momento, para que cambiar el catalogo no cambie lo ya pedido.
export type Eleccion = { opcion: string; tipo: "LISTA" | "TEXTO"; valor: string; suplementoCentimos: number };
export type LineaPreparada = { articuloId: string; articulo: string; importeCentimos: number; elecciones: Eleccion[] };

export class LineaNoValida extends Error {}

/** Espacios de mas fuera; nada de saltos de linea ni tabuladores. */
const limpiar = (texto: string) => texto.replace(/\s+/g, " ").trim();

export const prepararLinea = (catalogo: ArticuloCatalogo[], linea: LineaEntrada): LineaPreparada => {
  const articulo = catalogo.find((a) => a.id === linea.articuloId);
  if (!articulo) throw new LineaNoValida("Un artículo ya no está en el pedido");

  const porOpcion = new Map<string, LineaEntrada["elecciones"][number]>();
  for (const e of linea.elecciones) {
    if (!articulo.opciones.some((o) => o.id === e.opcionId)) throw new LineaNoValida(`Opción no válida en «${articulo.nombre}»`);
    if (porOpcion.has(e.opcionId)) throw new LineaNoValida(`Una opción de «${articulo.nombre}» aparece dos veces`);
    porOpcion.set(e.opcionId, e);
  }

  let importe = articulo.precioCentimos;
  const elecciones: Eleccion[] = [];
  for (const opcion of articulo.opciones) {
    const e = porOpcion.get(opcion.id);
    const donde = `«${opcion.nombre}» de «${articulo.nombre}»`;
    if (opcion.tipo === "LISTA") {
      if (!e?.valorId) {
        if (opcion.obligatoria) throw new LineaNoValida(`Elige ${donde}`);
        continue;
      }
      const valor = opcion.valores.find((v) => v.id === e.valorId);
      if (!valor) throw new LineaNoValida(`Valor no válido en ${donde}`);
      importe += valor.suplementoCentimos;
      elecciones.push({ opcion: opcion.nombre, tipo: "LISTA", valor: valor.valor, suplementoCentimos: valor.suplementoCentimos });
    } else {
      const texto = limpiar(e?.texto ?? "");
      if (!texto) {
        if (opcion.obligatoria) throw new LineaNoValida(`Escribe ${donde}`);
        continue;
      }
      if (texto.length > (opcion.maxLongitud ?? 0)) throw new LineaNoValida(`${donde}: como mucho ${opcion.maxLongitud} caracteres`);
      if (!TEXTO_SEGURO.test(texto)) throw new LineaNoValida(`${donde}: usa solo letras, números, espacios y signos sencillos`);
      importe += opcion.suplementoCentimos;
      elecciones.push({ opcion: opcion.nombre, tipo: "TEXTO", valor: texto, suplementoCentimos: opcion.suplementoCentimos });
    }
  }
  return { articuloId: articulo.id, articulo: articulo.nombre, importeCentimos: importe, elecciones };
};

/** Todas las lineas de una persona, respetando las unidades maximas de cada articulo. */
export const prepararLineas = (catalogo: ArticuloCatalogo[], lineas: LineaEntrada[], { conTope = true } = {}) => {
  const preparadas = lineas.map((l) => prepararLinea(catalogo, l));
  if (conTope) {
    for (const articulo of catalogo) {
      const unidades = preparadas.filter((l) => l.articuloId === articulo.id).length;
      if (unidades > articulo.maxUnidades) {
        throw new LineaNoValida(`De «${articulo.nombre}» se pueden pedir como mucho ${articulo.maxUnidades}`);
      }
    }
  }
  return preparadas;
};

export const totalDe = (lineas: { importeCentimos: number }[]) => lineas.reduce((n, l) => n + l.importeCentimos, 0);

/**
 * Para el proveedor (D-66): unidades de cada articulo por combinacion de opciones de lista, y los textos a estampar
 * con esas mismas opciones (la talla con su nombre), sin decir de quien son.
 */
export const resumenProveedor = (lineas: { articulo: string; elecciones: Eleccion[] }[]) => {
  const unidades = new Map<string, { articulo: string; opciones: string; unidades: number }>();
  const textos: { articulo: string; opciones: string; texto: string }[] = [];
  for (const l of lineas) {
    const deLista = l.elecciones.filter((e) => e.tipo === "LISTA");
    const opciones = deLista.map((e) => `${e.opcion}: ${e.valor}`).join(" · ");
    const clave = `${l.articulo}\u0000${opciones}`;
    const fila = unidades.get(clave) ?? { articulo: l.articulo, opciones, unidades: 0 };
    fila.unidades += 1;
    unidades.set(clave, fila);
    for (const e of l.elecciones.filter((e) => e.tipo === "TEXTO")) {
      textos.push({ articulo: l.articulo, opciones, texto: `${e.opcion}: ${e.valor}` });
    }
  }
  const orden = (a: { articulo: string; opciones: string }, b: { articulo: string; opciones: string }) =>
    a.articulo.localeCompare(b.articulo, "es") || a.opciones.localeCompare(b.opciones, "es", { numeric: true });
  return { unidades: [...unidades.values()].sort(orden), textos: textos.sort(orden) };
};

export type FilaProveedor = { articulo: string; opciones: string; unidades: number; nombre: string };

/**
 * El Excel para el proveedor, en una sola tabla: por articulo y opciones, una fila con las unidades sin texto y una
 * fila por cada texto a estampar (si el mismo texto se repite con las mismas opciones, se suman). Sin decir de quien
 * son. Con varias opciones de texto, el nombre las junta: "Nombre: Nora · Numero: 7".
 */
export const filasProveedor = (lineas: { articulo: string; elecciones: Eleccion[] }[]): FilaProveedor[] => {
  const filas = new Map<string, FilaProveedor>();
  for (const l of lineas) {
    const opciones = l.elecciones
      .filter((e) => e.tipo === "LISTA")
      .map((e) => `${e.opcion}: ${e.valor}`)
      .join(" · ");
    const textos = l.elecciones.filter((e) => e.tipo === "TEXTO");
    const nombre = textos.length === 1 ? textos[0].valor : textos.map((e) => `${e.opcion}: ${e.valor}`).join(" · ");
    const clave = [l.articulo, opciones, nombre].join("\u0000");
    const fila = filas.get(clave) ?? { articulo: l.articulo, opciones, unidades: 0, nombre };
    fila.unidades += 1;
    filas.set(clave, fila);
  }
  // Por articulo y opciones (tallas en orden natural); dentro, primero las que van sin texto y luego los textos.
  return [...filas.values()].sort(
    (a, b) =>
      a.articulo.localeCompare(b.articulo, "es") ||
      a.opciones.localeCompare(b.opciones, "es", { numeric: true }) ||
      Number(Boolean(a.nombre)) - Number(Boolean(b.nombre)) ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
};
