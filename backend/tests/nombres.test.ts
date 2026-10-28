import { compatibles, mismoNombre, normalizar, parecidos, persona, separarNombre, tokens } from "../src/utils/nombres.js";

// Todos los nombres son INVENTADOS (el repositorio es publico): cubren los casos de los listados reales sin
// copiar ninguno.

describe("normalizar y tokens", () => {
  it("quita tildes, abreviaturas y mayusculas", () => {
    expect(normalizar("Mº Carmen Pérez")).toEqual(["MARIA", "CARMEN", "PEREZ"]);
    expect(normalizar("Ángel Núñez Álvarez")).toEqual(["ANGEL", "NUNEZ", "ALVAREZ"]);
  });

  it("junta los apellidos compuestos y traduce diminutivos", () => {
    expect(tokens("Jaime Pérez de Arce Soto")).toEqual(["JAIME", "PEREZ DE ARCE", "SOTO"]);
    expect(tokens("Pepa Navarro Gil")).toEqual(["JOSEFA", "NAVARRO", "GIL"]);
  });
});

describe("parecidos", () => {
  it("admite una errata en palabras largas, no en cortas", () => {
    expect(parecidos("CASTILLO", "CASTILO")).toBe(true);
    expect(parecidos("JULIANA", "JULIANNA")).toBe(true);
    expect(parecidos("SARA", "SAUL")).toBe(false);
  });
});

describe("personas", () => {
  it("separa nombres compuestos y apellidos", () => {
    expect(persona("Juan José Prieto Calvo")).toMatchObject({ nombres: ["JUAN", "JOSE"], apellidos: ["PRIETO", "CALVO"] });
    expect(persona("Elena Salvador Ruiz")).toMatchObject({ nombres: ["ELENA"], apellidos: ["SALVADOR", "RUIZ"] });
  });

  it("reconoce a la misma persona escrita con menos apellidos o con erratas", () => {
    expect(compatibles(persona("Rosa Molina"), persona("Rosa Molina Vera"))).toBe(true);
    expect(compatibles(persona("Inés Castillo Rojo"), persona("Inés Castilo Rojo"))).toBe(true);
    expect(compatibles(persona("Juan Carlos Ibáñez"), persona("Juan Carlos Moreno Soto"))).toBe(false);
  });

  it("mismoNombre tolera erratas pero no nombres distintos", () => {
    expect(mismoNombre("Óscar Bernal Peña", "Oscar Bernat Peña")).toBe(true);
    expect(mismoNombre("Alba Ríos Gómez", "Alba Soler Vidal")).toBe(false);
  });
});

describe("separarNombre", () => {
  it.each([
    ["Pablo Ortega Ruiz", "Pablo", "Ortega Ruiz"],
    ["Miguel Ángel Serrano Gil", "Miguel Ángel", "Serrano Gil"],
    ["Lucía Ruiz de la Torre Gil", "Lucía", "Ruiz de la Torre Gil"],
    ["Daniel Gómez Pérez de Arce", "Daniel", "Gómez Pérez de Arce"],
    ["Alba Ríos", "Alba", "Ríos"],
    ["Gael", "Gael", ""],
    ["  Mario   Vera Soto ", "Mario", "Vera Soto"],
  ])("%s", (completo, nombre, apellidos) => {
    expect(separarNombre(completo)).toEqual({ nombre, apellidos });
  });
});
