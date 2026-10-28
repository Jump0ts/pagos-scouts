import { clasificar, clavePagador, combinaciones, descontar, type Contexto } from "../src/modules/movimientos/clasificacion.js";
import { persona } from "../src/utils/nombres.js";

// Datos inventados. Familia "gil": Lucía Ferrer Soto y Andrés Gil Rubio, con dos hijos (cuota 110 y 85, censo 30
// cada uno). Familia "navas": Carmen Vidal Ortega. Familia "diaz": Rosa Castillo (un solo apellido en el listado).
const contexto = (extra: Partial<Contexto> = {}): Contexto => ({
  pagadores: new Map(),
  familias: [
    { id: "gil", responsables: [persona("Lucía Ferrer Soto"), persona("Andrés Gil Rubio")], apellidosHijos: ["GIL", "FERRER"] },
    { id: "navas", responsables: [persona("Carmen Vidal Ortega")], apellidosHijos: ["NAVAS", "VIDAL"] },
    { id: "diaz", responsables: [persona("Rosa Castillo")], apellidosHijos: ["DIAZ", "CASTILLO"] },
  ],
  pendientes: new Map([
    [
      "gil",
      [
        { cargoId: "censo-sara", pendienteCentimos: 3000, orden: 1 },
        { cargoId: "censo-mateo", pendienteCentimos: 3000, orden: 1 },
        { cargoId: "cuota-sara", pendienteCentimos: 11000, orden: 2 },
        { cargoId: "cuota-mateo", pendienteCentimos: 8500, orden: 2 },
      ],
    ],
    ["navas", [{ cargoId: "cuota-irene", pendienteCentimos: 11000, orden: 2 }]],
    ["diaz", [{ cargoId: "cuota-leo", pendienteCentimos: 11000, orden: 2 }]],
  ]),
  conMarcas: new Set(),
  apuntados: new Map(),
  ...extra,
});

describe("combinaciones de cargos", () => {
  it("encuentra la única que suma el importe (2 censos + 2 cuotas = 255 €)", () => {
    const [c, ...resto] = combinaciones(contexto().pendientes.get("gil")!, 25500);
    expect(c.map((x) => x.cargoId)).toEqual(["censo-sara", "censo-mateo", "cuota-sara", "cuota-mateo"]);
    expect(resto).toEqual([]);
  });

  it("para en dos cuando hay varias (un censo de cualquiera de los hermanos)", () => {
    expect(combinaciones(contexto().pendientes.get("gil")!, 3000)).toHaveLength(2);
  });

  it("no hay ninguna si no cuadra o el importe no es positivo", () => {
    expect(combinaciones(contexto().pendientes.get("gil")!, 5000)).toEqual([]);
    expect(combinaciones(contexto().pendientes.get("gil")!, 0)).toEqual([]);
  });
});

describe("clasificar (D-5)", () => {
  it("clasifica solo con nombre y apellidos completos y una única combinación, en cualquier orden", () => {
    // 195 € solo pueden ser las dos cuotas (110 + 85).
    const r = clasificar("FERRER SOTO LUCIA", 19500, contexto());
    expect(r).toEqual({
      estado: "CLASIFICADO",
      familiaId: "gil",
      asignaciones: [
        { cargoId: "cuota-sara", importeCentimos: 11000 },
        { cargoId: "cuota-mateo", importeCentimos: 8500 },
      ],
    });
  });

  it("tolera erratas y tildes en el nombre del banco", () => {
    expect(clasificar("Andres Gil Rubyo", 8500, contexto())).toMatchObject({ estado: "CLASIFICADO", familiaId: "gil" });
  });

  it("un pagador aprendido identifica a la familia aunque no se parezca a nadie (D-1)", () => {
    const ctx = contexto({ pagadores: new Map([[clavePagador("Abuela Charo Romero"), "navas"]]) });
    expect(clasificar("ROMERO ABUELA ROSARIO", 11000, ctx)).toMatchObject({ estado: "CLASIFICADO", familiaId: "navas" });
  });

  it("varias combinaciones posibles: a Dudas con la primera sugerida", () => {
    expect(clasificar("Lucía Ferrer Soto", 3000, contexto())).toEqual({
      estado: "DUDA",
      motivo: "VARIAS_COMBINACIONES",
      familiaId: "gil",
      cargosSugeridos: ["censo-sara"],
    });
  });

  it("un importe que no cuadra (parcial o de más) va a Dudas (D-5b)", () => {
    expect(clasificar("Lucía Ferrer Soto", 5000, contexto())).toMatchObject({ estado: "DUDA", motivo: "NO_CUADRA", familiaId: "gil" });
  });

  it("si la familia tiene marcas del listado, avisa de que puede estar ya pagado (D-44)", () => {
    const ctx = contexto({ conMarcas: new Set(["gil"]) });
    expect(clasificar("Lucía Ferrer Soto", 5000, ctx)).toMatchObject({ motivo: "POSIBLE_YA_MARCADO" });
  });

  it("un pago a mano del mismo importe sin cruzar manda el del banco a Dudas, una sola vez (D-51)", () => {
    const ctx = contexto({ apuntados: new Map([["gil", [{ id: "m1", origen: "MANUAL", importeCentimos: 19500 }]]]) });
    expect(clasificar("Lucía Ferrer Soto", 19500, ctx)).toEqual({ estado: "DUDA", motivo: "POSIBLE_YA_APUNTADO", familiaId: "gil", cargosSugeridos: [] });
    // El segundo ingreso igual ya no tiene con qué cruzarse: se clasifica normalmente.
    expect(clasificar("Lucía Ferrer Soto", 19500, ctx)).toMatchObject({ estado: "CLASIFICADO" });
  });

  it("con solo un apellido en el listado no es seguro: sugiere la familia y sus cargos", () => {
    expect(clasificar("ROSA CASTILLO QUINTANA", 11000, contexto())).toEqual({
      estado: "DUDA",
      motivo: "FAMILIA_SIN_CONFIRMAR",
      familiaId: "diaz",
      cargosSugeridos: ["cuota-leo"],
    });
  });

  it("solo comparte apellido: familia sin confirmar; nadie parecido: pagador desconocido", () => {
    expect(clasificar("FERMIN GIL OLMEDO", 11000, contexto())).toMatchObject({ motivo: "FAMILIA_SIN_CONFIRMAR", familiaId: "gil" });
    expect(clasificar("ASOCIACION VECINAL", 11000, contexto())).toEqual({
      estado: "DUDA",
      motivo: "PAGADOR_DESCONOCIDO",
      familiaId: null,
      cargosSugeridos: [],
    });
  });

  it("lo clasificado deja de estar pendiente para el siguiente pago", () => {
    const ctx = contexto();
    expect(clasificar("Lucía Ferrer Soto", 11000, ctx)).toMatchObject({ estado: "CLASIFICADO" });
    const primero = clasificar("Lucía Ferrer Soto", 19500, ctx);
    if (primero.estado !== "CLASIFICADO") throw new Error("debería clasificarse");
    descontar(ctx, "gil", primero.asignaciones);
    // Las cuotas ya están pagadas: otros 110 € ya no cuadran, y los dos censos juntos sí.
    expect(clasificar("Lucía Ferrer Soto", 11000, ctx)).toMatchObject({ estado: "DUDA", motivo: "NO_CUADRA" });
    expect(clasificar("Lucía Ferrer Soto", 6000, ctx)).toMatchObject({ estado: "CLASIFICADO", familiaId: "gil" });
  });
});
