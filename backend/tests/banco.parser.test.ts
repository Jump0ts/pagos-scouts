import { leerMovimientosBanco } from "../src/modules/movimientos/banco.parser.js";
import { excelBanco } from "./fixtures/banco.js";

describe("Excel de movimientos del banco", () => {
  it.each(["xls", "xlsx"] as const)("lee los ingresos de un .%s y cuenta las salidas sin guardarlas (D-42)", (tipo) => {
    const leido = leerMovimientosBanco(
      excelBanco(
        [
          [12, "2026-10-26", "LUCIA FERRER SOTO", 140],
          [11, "2026-10-25", "COMISION MANTENIMIENTO", -6.5],
          [10, "2026-10-02", "CARMEN  VIDAL ORTEGA", 110.5],
        ],
        tipo,
      ),
    );
    expect(leido.salidas).toBe(1);
    expect(leido.ingresos.map((m) => ({ ...m, fecha: m.fecha.toISOString().slice(0, 10) }))).toEqual([
      { numero: 12, fecha: "2026-10-26", concepto: "LUCIA FERRER SOTO", importeCentimos: 14000 },
      { numero: 10, fecha: "2026-10-02", concepto: "CARMEN VIDAL ORTEGA", importeCentimos: 11050 },
    ]);
  });

  it("lee un CSV con importes y fechas en español", () => {
    const csv = "Fecha de operación;Concepto;Importe;Nº mov\n26/10/2026;LUCIA FERRER SOTO;1.110,00;7\n27/10/2026;GASTO;-20,00;8\n";
    const leido = leerMovimientosBanco(Buffer.from(csv, "utf8"));
    expect(leido.ingresos).toEqual([{ numero: 7, fecha: new Date("2026-10-26T00:00:00Z"), concepto: "LUCIA FERRER SOTO", importeCentimos: 111000 }]);
    expect(leido.salidas).toBe(1);
  });

  it("rechaza un Excel que no es de movimientos", () => {
    const csv = "Padres;Educando\nRosa Castillo Rojo;Leo Díaz Castillo\n";
    expect(() => leerMovimientosBanco(Buffer.from(csv, "utf8"))).toThrow(/Concepto/);
  });
});
