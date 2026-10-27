import { calcularCargos, type ConfigPrecios, type NinoConCargo } from "../src/modules/eventos/cargos.calculo.js";

// Niños inventados.
const nino = (cargoId: string, familiaId: string, seccion: string, orden: number, nacimiento: string | null): NinoConCargo => ({
  cargoId,
  familiaId,
  seccionId: seccion,
  ordenSeccion: orden,
  fechaNacimiento: nacimiento ? new Date(nacimiento) : null,
  nombre: cargoId,
});

const cuota = (descuento: boolean, segundo: number | null = 8500, tercero: number | null = 6000): ConfigPrecios => ({
  preciosPorSeccion: new Map([["castores", 11000], ["manada", 11000], ["tropa", 11000]]),
  descuentoHermanos: descuento,
  precioSegundoCentimos: segundo,
  precioTerceroCentimos: tercero,
});

const importes = (r: ReturnType<typeof calcularCargos>) =>
  Object.fromEntries([...r].map(([id, v]) => [id, [v.posicion, v.importeCentimos]]));

describe("calcularCargos (D-34)", () => {
  it("sin precio de hermanos, cada uno paga el de su sección", () => {
    const r = calcularCargos([nino("sara", "f1", "tropa", 2, null), nino("leo", "f1", "castores", 0, null)], cuota(false));
    expect(importes(r)).toEqual({ sara: [1, 11000], leo: [2, 11000] });
  });

  it("con precio de hermanos: 110 / 85 / 60, el mayor por fecha de nacimiento paga el completo", () => {
    const r = calcularCargos(
      [
        nino("leo", "f1", "castores", 0, "2019-05-01"),
        nino("sara", "f1", "tropa", 2, "2013-02-10"),
        nino("mateo", "f1", "manada", 1, "2016-09-20"),
      ],
      cuota(true),
    );
    expect(importes(r)).toEqual({ sara: [1, 11000], mateo: [2, 8500], leo: [3, 6000] });
  });

  it("sin fechas de nacimiento, el de la sección de más edad es el mayor", () => {
    const r = calcularCargos([nino("leo", "f1", "castores", 0, null), nino("sara", "f1", "tropa", 2, null)], cuota(true));
    expect(importes(r)).toEqual({ sara: [1, 11000], leo: [2, 8500] });
  });

  it("el 4º y siguientes pagan como el 3º; sin precio de 3º, como el 2º", () => {
    const cuatro = [
      nino("a", "f1", "tropa", 2, "2012-01-01"),
      nino("b", "f1", "tropa", 2, "2013-01-01"),
      nino("c", "f1", "manada", 1, "2015-01-01"),
      nino("d", "f1", "castores", 0, "2018-01-01"),
    ];
    expect(importes(calcularCargos(cuatro, cuota(true)))).toEqual({ a: [1, 11000], b: [2, 8500], c: [3, 6000], d: [4, 6000] });
    expect(importes(calcularCargos(cuatro, cuota(true, 8500, null)))).toMatchObject({ c: [3, 8500], d: [4, 8500] });
  });

  it("nunca cobra más que el precio de su sección", () => {
    const campamento: ConfigPrecios = {
      preciosPorSeccion: new Map([["castores", 7000], ["tropa", 15000]]),
      descuentoHermanos: true,
      precioSegundoCentimos: 8500,
      precioTerceroCentimos: null,
    };
    const r = calcularCargos([nino("sara", "f1", "tropa", 2, null), nino("leo", "f1", "castores", 0, null)], campamento);
    expect(importes(r)).toEqual({ sara: [1, 15000], leo: [2, 7000] });
  });

  it("cada familia cuenta por separado", () => {
    const r = calcularCargos([nino("sara", "f1", "tropa", 2, null), nino("hugo", "f2", "castores", 0, null)], cuota(true));
    expect(importes(r)).toEqual({ sara: [1, 11000], hugo: [1, 11000] });
  });
});
