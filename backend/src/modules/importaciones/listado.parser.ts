import { badRequest } from "../../utils/errors.js";
import { leerHoja } from "../../utils/hoja.js";
import { normalizar, tokens } from "../../utils/nombres.js";

export const MAX_FILAS = 3000;

const CABECERA_RESPONSABLES = /PADRE|MADRE|TUTOR|FAMILIA|RESPONSABLE/;
const CABECERA_NINO = /NINO|NINA|EDUCANDO|SCOUT|HIJO|CHAVAL|NOMBRE|ALUMNO/;

// pagado: claves de las columnas en las que el niño tiene la marca "Pagado" (D-44).
export type FilaListado = { fila: number; bloque: number; nino: string; responsables: string[]; pagado: string[] };

export type ColumnaPago = { clave: string; titulo: string; marcas: number };

export type ListadoLeido = {
  filas: FilaListado[];
  bloques: number;
  // Columnas que no son de responsables ni de niños.
  columnasIgnoradas: string[];
  // Las que tienen alguna marca "Pagado": se pueden ligar a un evento (D-44).
  columnasPago: ColumnaPago[];
};

const esMarcaPagado = (celda: string) => normalizar(celda)[0]?.startsWith("PAGAD") ?? false;

// Primera hoja del Excel (o CSV) como filas de texto.
export const leerFilas = (contenido: Buffer): string[][] =>
  leerHoja(contenido).map((fila) => fila.map((celda) => String(celda ?? "").trim()));

/**
 * Formato de los listados de los grupos: una columna con los responsables separados por "/" y otra con el niño.
 * Cada vez que se repite la cabecera empieza un bloque nuevo (en la practica, una seccion: D-28).
 * Sin cabecera se usan las columnas A (responsables) y B (niño).
 */
export const interpretarListado = (filas: string[][]): ListadoLeido => {
  if (filas.length > MAX_FILAS) throw badRequest(`El listado tiene más de ${MAX_FILAS} filas`);

  let colResponsables: number | null = null;
  let colNino: number | null = null;
  let bloque = 0;
  let ninosEnBloque = 0;
  // Por nombre normalizado: "Pago Cuota" y "Pago cuota " son la misma columna.
  const ignoradas = new Map<string, string>();
  // Columna -> clave de la columna ignorada, segun la ultima cabecera.
  let clavesPorColumna = new Map<number, string>();
  const marcas = new Map<string, number>();
  const resultado: FilaListado[] = [];

  filas.forEach((celdas, i) => {
    const normalizadas = celdas.map((c) => normalizar(c).join(" "));
    const iResp = normalizadas.findIndex((c) => CABECERA_RESPONSABLES.test(c));
    const iNino = normalizadas.findIndex((c, j) => j !== iResp && CABECERA_NINO.test(c));
    if (iResp >= 0 && iNino >= 0) {
      colResponsables = iResp;
      colNino = iNino;
      clavesPorColumna = new Map();
      celdas.forEach((c, j) => {
        const clave = normalizadas[j];
        if (j === iResp || j === iNino || !clave) return;
        clavesPorColumna.set(j, clave);
        if (!ignoradas.has(clave)) ignoradas.set(clave, c.replace(/\s+/g, " "));
      });
      if (ninosEnBloque > 0) {
        bloque += 1;
        ninosEnBloque = 0;
      }
      return;
    }

    const nino = celdas[colNino ?? 1] ?? "";
    if (tokens(nino).length === 0) return; // filas vacias, "?", espacios...
    const responsables = (celdas[colResponsables ?? 0] ?? "")
      .split("/")
      .map((r) => r.trim().replace(/\s+/g, " "))
      .filter((r) => tokens(r).length > 0);
    const pagado = [...clavesPorColumna].filter(([j]) => esMarcaPagado(celdas[j] ?? "")).map(([, clave]) => clave);
    pagado.forEach((c) => marcas.set(c, (marcas.get(c) ?? 0) + 1));
    resultado.push({ fila: i + 1, bloque, nino: nino.replace(/\s+/g, " "), responsables, pagado });
    ninosEnBloque += 1;
  });

  if (resultado.length === 0) {
    throw badRequest("No se ha encontrado ningún niño. Revisa que haya una columna con los responsables y otra con el niño.");
  }
  return {
    filas: resultado,
    bloques: bloque + 1,
    columnasIgnoradas: [...ignoradas.values()],
    columnasPago: [...marcas].map(([clave, n]) => ({ clave, titulo: ignoradas.get(clave)!, marcas: n })),
  };
};
