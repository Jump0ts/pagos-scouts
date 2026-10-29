import * as XLSX from "xlsx";
import { textoParaExcel as t } from "../../utils/hoja.js";
import type { EstadoPago } from "../eventos/cargos.utils.js";
import type { resumenProveedor } from "./pedidos.calculo.js";

// D-66: dos Excel de un pedido. Se crean en memoria y nunca se guardan; todo texto pasa por textoParaExcel (D-70).

const ESTADO: Record<EstadoPago, string> = { PENDIENTE: "Pendiente", PARCIAL: "A medias", PAGADO: "Pagado", EXENTO: "Exento" };
const EUROS = '#,##0.00 "€"';
const aEuros = (centimos: number) => centimos / 100;

export type PersonaExportada = {
  nombre: string;
  apellidos: string;
  seccion: string;
  lineas: string[];
  importeCentimos: number;
  pagadoCentimos: number;
  estado: EstadoPago;
};

const libroCon = (hojas: [string, XLSX.WorkSheet][]) => {
  const libro = XLSX.utils.book_new();
  for (const [nombre, hoja] of hojas) XLSX.utils.book_append_sheet(libro, hoja, nombre);
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

/** Por persona: que ha pedido, cuanto debe y cuanto ha pagado. */
export const excelPorPersona = ({ pedido, curso, personas }: { pedido: string; curso: string; personas: PersonaExportada[] }) => {
  const cabecera = ["Nombre", "Apellidos", "Sección", "Pedido", "Importe", "Pagado", "Pendiente", "Estado"];
  const cobrado = personas.reduce((n, p) => n + p.pagadoCentimos, 0);
  const pendiente = personas.reduce((n, p) => n + p.importeCentimos - p.pagadoCentimos, 0);
  const resumen = [
    [t(pedido)],
    [`Curso ${curso} · ${personas.length} ${personas.length === 1 ? "persona" : "personas"}`],
    ["Cobrado", aEuros(cobrado), "Pendiente", aEuros(pendiente)],
    [],
  ];
  const cuerpo = personas.map((p) => [
    t(p.nombre),
    t(p.apellidos),
    t(p.seccion),
    t(p.lineas.join("\n")),
    aEuros(p.importeCentimos),
    aEuros(p.pagadoCentimos),
    aEuros(p.importeCentimos - p.pagadoCentimos),
    ESTADO[p.estado],
  ]);
  const hoja = XLSX.utils.aoa_to_sheet([...resumen, cabecera, ...cuerpo]);
  for (const ref of ["B3", "D3"]) hoja[ref].z = EUROS;
  const primera = resumen.length + 1;
  cuerpo.forEach((_, i) => {
    for (const col of ["E", "F", "G"]) hoja[`${col}${primera + i + 1}`].z = EUROS;
  });
  hoja["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 48 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }];
  hoja["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: primera - 1, c: 0 }, e: { r: primera - 1 + cuerpo.length, c: cabecera.length - 1 } }) };
  return libroCon([["Por persona", hoja]]);
};

/** Para el proveedor: unidades por articulo y opciones, y los textos a estampar sin decir de quien son. */
export const excelProveedor = ({ pedido, resumen }: { pedido: string; resumen: ReturnType<typeof resumenProveedor> }) => {
  const total = resumen.unidades.reduce((n, u) => n + u.unidades, 0);
  const unidades = XLSX.utils.aoa_to_sheet([
    [t(pedido)],
    [`${total} ${total === 1 ? "unidad" : "unidades"}`],
    [],
    ["Artículo", "Opciones", "Unidades"],
    ...resumen.unidades.map((u) => [t(u.articulo), t(u.opciones), u.unidades]),
  ]);
  unidades["!cols"] = [{ wch: 24 }, { wch: 40 }, { wch: 10 }];
  const textos = XLSX.utils.aoa_to_sheet([
    ["Artículo", "Opciones", "Texto"],
    ...resumen.textos.map((x) => [t(x.articulo), t(x.opciones), t(x.texto)]),
  ]);
  textos["!cols"] = [{ wch: 24 }, { wch: 40 }, { wch: 30 }];
  return libroCon([
    ["Unidades", unidades],
    ["Textos", textos],
  ]);
};
