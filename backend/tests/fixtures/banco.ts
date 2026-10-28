import * as XLSX from "xlsx";

// Excel de movimientos INVENTADO con la forma del de Unicaja: filas con los datos de la cuenta, la cabecera y los
// movimientos del mas reciente al mas antiguo. Los nombres no son de nadie.
export type MovimientoFicticio = [numero: number, fecha: string, concepto: string, importe: number];

const CABECERA = ["Fecha de operación", "Fecha valor", "Concepto", "Importe", "Divisa", "Saldo", "Divisa", "Nº mov", "Oficina "];

const aFecha = (texto: string) => {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d);
};

export const excelBanco = (movimientos: MovimientoFicticio[], bookType: "xls" | "xlsx" = "xlsx") => {
  const filas: unknown[][] = [
    [],
    ["Movimientos de la cuenta"],
    ["Cuenta", "", "ES00 0000 0000 0000 0000 0000"],
    ["Titular", "", "Grupo Scout Pinar"],
    [],
    CABECERA,
    ...movimientos.map(([numero, fecha, concepto, importe]) => [aFecha(fecha), aFecha(fecha), concepto, importe, "EUR", 1000, "EUR", numero, 30]),
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas, { cellDates: true }), "Movimientos");
  return XLSX.write(libro, { type: "buffer", bookType }) as Buffer;
};
