import * as XLSX from "xlsx";
import { badRequest } from "../../utils/errors.js";
import { leerHoja } from "../../utils/hoja.js";
import { normalizar } from "../../utils/nombres.js";

export const MAX_MOVIMIENTOS = 5000;

export type MovimientoLeido = { numero: number | null; fecha: Date; concepto: string; importeCentimos: number };

export type BancoLeido = { ingresos: MovimientoLeido[]; salidas: number };

const clave = (celda: unknown) => normalizar(String(celda ?? "")).join(" ");

// "1.234,56" (CSV en español), "1234.56" o un numero ya leido de Excel, en centimos.
const aCentimos = (valor: unknown): number | null => {
  if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor * 100) : null;
  const texto = String(valor ?? "").replace(/\s|€|EUR/gi, "");
  if (!texto) return null;
  const normal = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

const fechaUtc = (anio: number, mes: number, dia: number) => {
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia ? f : null;
};

// SheetJS da las fechas de Excel como Date a medianoche de la hora local: se toma el dia local.
const aFecha = (valor: unknown): Date | null => {
  if (valor instanceof Date) return fechaUtc(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  if (typeof valor === "number") {
    const d = XLSX.SSF.parse_date_code(valor);
    return d ? fechaUtc(d.y, d.m, d.d) : null;
  }
  const m = String(valor ?? "").trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!m) return null;
  const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return fechaUtc(anio, Number(m[2]), Number(m[1]));
};

/**
 * Excel de movimientos de Unicaja: unas filas con los datos de la cuenta y despues una cabecera con "Fecha de
 * operación", "Concepto", "Importe" y "Nº mov". El concepto de un ingreso es solo el nombre de quien paga.
 * D-42: las salidas (importes negativos) no se guardan; solo se cuentan.
 */
export const leerMovimientosBanco = (contenido: Buffer): BancoLeido => {
  const filas = leerHoja(contenido, { raw: true });
  const iCabecera = filas.findIndex((f) => f.some((c) => clave(c) === "CONCEPTO") && f.some((c) => clave(c) === "IMPORTE"));
  if (iCabecera < 0) {
    throw badRequest("No parece un Excel de movimientos del banco: falta la fila con «Concepto» e «Importe».");
  }
  const cabecera = filas[iCabecera].map(clave);
  const iConcepto = cabecera.indexOf("CONCEPTO");
  const iImporte = cabecera.indexOf("IMPORTE");
  const iFecha = cabecera.findIndex((c) => c.startsWith("FECHA"));
  const iNumero = cabecera.findIndex((c) => c.endsWith("MOV"));
  if (iFecha < 0) throw badRequest("No parece un Excel de movimientos del banco: falta la columna de la fecha.");

  const datos = filas.slice(iCabecera + 1);
  if (datos.length > MAX_MOVIMIENTOS) throw badRequest(`El Excel tiene más de ${MAX_MOVIMIENTOS} movimientos; súbelo por partes`);

  const ingresos: MovimientoLeido[] = [];
  let salidas = 0;
  for (const fila of datos) {
    const importeCentimos = aCentimos(fila[iImporte]);
    const fecha = aFecha(fila[iFecha]);
    if (importeCentimos === null || importeCentimos === 0 || !fecha) continue; // filas de totales, vacias...
    if (importeCentimos < 0) {
      salidas += 1;
      continue;
    }
    const numero = iNumero >= 0 ? Number(String(fila[iNumero]).trim()) : NaN;
    ingresos.push({
      numero: Number.isInteger(numero) && String(fila[iNumero]).trim() !== "" ? numero : null,
      fecha,
      concepto: String(fila[iConcepto] ?? "").replace(/\s+/g, " ").trim(),
      importeCentimos,
    });
  }
  if (!ingresos.length && !salidas) throw badRequest("El Excel no tiene ningún movimiento.");
  return { ingresos, salidas };
};
