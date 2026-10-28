import { aCentimos, aTextoEuros, euros } from "./dinero";

describe("dinero", () => {
  it.each([
    ["85", 8500],
    ["85,5", 8550],
    ["85,50 €", 8550],
    ["1.234,56", 123456],
    ["1.234", 123400],
    ["85.50", 8550],
    ["0", 0],
  ])("%s son %i céntimos", (texto, centimos) => {
    expect(aCentimos(texto)).toBe(centimos);
  });

  it.each(["", "abc", "85,555", "-5", "8,5,5"])("%s no es un importe", (texto) => {
    expect(aCentimos(texto)).toBeNull();
  });

  it("muestra y rellena importes", () => {
    expect(euros(8550).replace(/\s/g, " ")).toBe("85,50 €");
    expect(aTextoEuros(8500)).toBe("85");
    expect(aTextoEuros(8550)).toBe("85,50");
    expect(aTextoEuros(null)).toBe("");
  });
});
