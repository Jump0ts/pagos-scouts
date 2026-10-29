import * as XLSX from "xlsx";
import { badRequest } from "./errors.js";

const esExcel = (b: Buffer) =>
  b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || // .xlsx (zip)
  b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])); // .xls antiguo

// Un CSV puede venir en UTF-8 (con o sin BOM; TextDecoder ya quita el BOM) o en Windows-1252, la codificacion de
// Excel en español.
const textoDeCsv = (b: Buffer) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return new TextDecoder("windows-1252").decode(b);
  }
};

/**
 * Primera hoja del Excel (o CSV) como filas. Con `raw` las celdas llegan con su tipo (numeros y fechas); sin el,
 * como el texto que se ve en Excel. El fichero se lee en memoria y nunca se guarda.
 */
export const leerHoja = (contenido: Buffer, { raw = false } = {}): unknown[][] => {
  try {
    const libro = esExcel(contenido)
      ? XLSX.read(contenido, { type: "buffer", dense: true, cellDates: true })
      : XLSX.read(textoDeCsv(contenido), { type: "string", dense: true, cellDates: true, raw: true });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    if (!hoja) throw new Error("sin hojas");
    return XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, raw, defval: "", blankrows: false });
  } catch {
    throw badRequest("No se ha podido leer el fichero. Sube el Excel tal como lo guardas (.xlsx, .xls o .csv).");
  }
};

/**
 * D-70: un texto que empieza por =, +, -, @, tabulador o retorno puede ejecutarse como formula al abrir el Excel (o
 * un CSV sacado de el). Se le antepone un apostrofo para que siempre sea texto.
 */
export const textoParaExcel = (texto: string) => (/^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto);
