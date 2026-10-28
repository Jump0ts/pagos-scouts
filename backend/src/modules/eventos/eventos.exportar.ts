import * as XLSX from "xlsx";
import type { EstadoPago } from "./cargos.utils.js";

export type FilaExportada = {
  nombre: string;
  apellidos: string;
  seccion: string;
  importeCentimos: number;
  pagadoCentimos: number;
  estado: EstadoPago;
};

type Datos = { evento: string; curso: string; seccion?: string; estado?: EstadoPago; filas: FilaExportada[] };

const ESTADO: Record<EstadoPago, string> = { PENDIENTE: "Pendiente", PARCIAL: "A medias", PAGADO: "Pagado", EXENTO: "Exento" };
const FILTRO: Record<EstadoPago, string> = { PENDIENTE: "Pendientes", PARCIAL: "A medias", PAGADO: "Pagados", EXENTO: "Exentos" };
const EUROS = '#,##0.00 "€"';
const CABECERA = ["Nombre", "Apellidos", "Sección", "Importe", "Pagado", "Pendiente", "Estado"];

const aEuros = (centimos: number) => centimos / 100;

/** D-53 y D-54: el estado de un evento como .xlsx, con un resumen arriba y una fila por niño. Se crea en memoria. */
export const excelDeEvento = ({ evento, curso, seccion, estado, filas }: Datos): Buffer => {
  const cobrado = filas.reduce((n, f) => n + f.pagadoCentimos, 0);
  const pendiente = filas.reduce((n, f) => n + f.importeCentimos - f.pagadoCentimos, 0);
  const filtro = [seccion, estado && FILTRO[estado]].filter(Boolean).join(" · ");
  const resumen = [
    [evento],
    [`Curso ${curso}${filtro ? ` · ${filtro}` : ""} · ${filas.length} ${filas.length === 1 ? "niño" : "niños"}`],
    ["Cobrado", aEuros(cobrado), "Pendiente", aEuros(pendiente)],
    [],
  ];
  const cuerpo = filas.map((f) => [
    f.nombre,
    f.apellidos,
    f.seccion,
    aEuros(f.importeCentimos),
    aEuros(f.pagadoCentimos),
    aEuros(f.importeCentimos - f.pagadoCentimos),
    ESTADO[f.estado],
  ]);
  const hoja = XLSX.utils.aoa_to_sheet([...resumen, CABECERA, ...cuerpo]);

  // Formato de euros en el resumen y en las columnas de importes.
  for (const ref of ["B3", "D3"]) hoja[ref].z = EUROS;
  const primera = resumen.length + 1;
  cuerpo.forEach((_, i) => {
    for (const col of ["D", "E", "F"]) hoja[`${col}${primera + i + 1}`].z = EUROS;
  });

  hoja["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  hoja["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: primera - 1, c: 0 }, e: { r: primera - 1 + cuerpo.length, c: CABECERA.length - 1 } }) };

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Estado");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
};
