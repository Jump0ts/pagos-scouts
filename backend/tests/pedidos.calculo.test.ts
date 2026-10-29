import { LineaNoValida, prepararLinea, prepararLineas, resumenProveedor, type ArticuloCatalogo } from "../src/modules/pedidos/pedidos.calculo.js";
import { buscarPersona, type Candidato } from "../src/modules/pedidos/pedidos.revision.js";
import { textoParaExcel } from "../src/utils/hoja.js";

// Datos inventados. Una camiseta con talla y nombre al dorso opcional (+3 €).
const camiseta: ArticuloCatalogo = {
  id: "cam",
  nombre: "Camiseta",
  precioCentimos: 1200,
  maxUnidades: 2,
  opciones: [
    {
      id: "talla",
      nombre: "Talla",
      tipo: "LISTA",
      obligatoria: true,
      maxLongitud: null,
      suplementoCentimos: 0,
      valores: [
        { id: "t10", valor: "9/10", suplementoCentimos: 0 },
        { id: "tXL", valor: "XL", suplementoCentimos: 200 },
      ],
    },
    { id: "dorso", nombre: "Nombre al dorso", tipo: "TEXTO", obligatoria: false, maxLongitud: 12, suplementoCentimos: 300, valores: [] },
  ],
};
const catalogo = [camiseta];

describe("prepararLinea", () => {
  it("precio del artículo más los suplementos de lo elegido", () => {
    const linea = prepararLinea(catalogo, {
      articuloId: "cam",
      elecciones: [
        { opcionId: "talla", valorId: "tXL" },
        { opcionId: "dorso", texto: "  Nora  " },
      ],
    });
    expect(linea).toEqual({
      articuloId: "cam",
      articulo: "Camiseta",
      importeCentimos: 1700,
      elecciones: [
        { opcion: "Talla", tipo: "LISTA", valor: "XL", suplementoCentimos: 200 },
        { opcion: "Nombre al dorso", tipo: "TEXTO", valor: "Nora", suplementoCentimos: 300 },
      ],
    });
  });

  it("una opción no obligatoria se puede dejar vacía y no suma", () => {
    const linea = prepararLinea(catalogo, { articuloId: "cam", elecciones: [{ opcionId: "talla", valorId: "t10" }, { opcionId: "dorso", texto: " " }] });
    expect(linea.importeCentimos).toBe(1200);
    expect(linea.elecciones).toHaveLength(1);
  });

  it.each([
    ["falta una obligatoria", { articuloId: "cam", elecciones: [] }, /Elige «Talla»/],
    ["artículo de otro pedido", { articuloId: "otro", elecciones: [] }, /ya no está/],
    ["valor que no existe", { articuloId: "cam", elecciones: [{ opcionId: "talla", valorId: "t99" }] }, /Valor no válido/],
    ["opción que no existe", { articuloId: "cam", elecciones: [{ opcionId: "color", valorId: "x" }] }, /Opción no válida/],
    [
      "opción repetida",
      { articuloId: "cam", elecciones: [{ opcionId: "talla", valorId: "t10" }, { opcionId: "talla", valorId: "tXL" }] },
      /dos veces/,
    ],
    [
      "texto demasiado largo",
      { articuloId: "cam", elecciones: [{ opcionId: "talla", valorId: "t10" }, { opcionId: "dorso", texto: "Maximiliano Ruiz" }] },
      /como mucho 12/,
    ],
  ])("rechaza: %s", (_, linea, mensaje) => {
    expect(() => prepararLinea(catalogo, linea)).toThrow(mensaje);
  });

  it.each(["=HYPERLINK(1)", "+1", "@SUMA", "-2", "<script>", "Nora\u0000"])("rechaza un texto que podría ser fórmula o código: %s", (texto) => {
    expect(() => prepararLinea(catalogo, { articuloId: "cam", elecciones: [{ opcionId: "talla", valorId: "t10" }, { opcionId: "dorso", texto }] })).toThrow(
      LineaNoValida,
    );
  });

  it("acepta tildes, eñes, apóstrofos y guiones en el texto", () => {
    const linea = prepararLinea(catalogo, { articuloId: "cam", elecciones: [{ opcionId: "talla", valorId: "t10" }, { opcionId: "dorso", texto: "Iñaki O'Ryan" }] });
    expect(linea.elecciones[1].valor).toBe("Iñaki O'Ryan");
  });
});

describe("prepararLineas", () => {
  const una = { articuloId: "cam", elecciones: [{ opcionId: "talla", valorId: "t10" }] };

  it("respeta las unidades máximas del artículo", () => {
    expect(prepararLineas(catalogo, [una, una])).toHaveLength(2);
    expect(() => prepararLineas(catalogo, [una, una, una])).toThrow(/como mucho 2/);
  });

  it("sin tope para lo que apunta Tesorería a mano", () => {
    expect(prepararLineas(catalogo, [una, una, una], { conTope: false })).toHaveLength(3);
  });
});

describe("resumenProveedor", () => {
  it("cuenta unidades por talla y saca los textos con su talla, sin decir de quién son", () => {
    const linea = (talla: string, dorso?: string) => ({
      articulo: "Camiseta",
      elecciones: [
        { opcion: "Talla", tipo: "LISTA" as const, valor: talla, suplementoCentimos: 0 },
        ...(dorso ? [{ opcion: "Nombre al dorso", tipo: "TEXTO" as const, valor: dorso, suplementoCentimos: 300 }] : []),
      ],
    });
    const resumen = resumenProveedor([linea("XL"), linea("9/10", "Nora"), linea("9/10"), linea("11/12", "Bruno")]);
    expect(resumen.unidades).toEqual([
      { articulo: "Camiseta", opciones: "Talla: 9/10", unidades: 2 },
      { articulo: "Camiseta", opciones: "Talla: 11/12", unidades: 1 },
      { articulo: "Camiseta", opciones: "Talla: XL", unidades: 1 },
    ]);
    expect(resumen.textos).toEqual([
      { articulo: "Camiseta", opciones: "Talla: 9/10", texto: "Nombre al dorso: Nora" },
      { articulo: "Camiseta", opciones: "Talla: 11/12", texto: "Nombre al dorso: Bruno" },
    ]);
  });
});

describe("buscarPersona (semáforo)", () => {
  const educandos: Candidato[] = [
    { educandoId: "1", nombre: "Nora", apellidos: "Vidal Soler", seccionId: "manada" },
    { educandoId: "2", nombre: "Bruno", apellidos: "Vidal Soler", seccionId: "tropa" },
    { educandoId: "3", nombre: "Iker", apellidos: "Molina Ros", seccionId: "manada" },
    { educandoId: "4", nombre: "Iker", apellidos: "Molina Pardo", seccionId: "tropa" },
  ];

  it("reconocido: nombre exacto (con erratas y sin tildes) y su sección", () => {
    const r = buscarPersona({ nombre: "nora", apellidos: "Bidal Soler", seccionId: "manada" }, educandos);
    expect(r).toEqual({ semaforo: "RECONOCIDO", candidatos: [educandos[0]] });
  });

  it("reconocido: con un solo apellido, si no hay otro igual", () => {
    expect(buscarPersona({ nombre: "Bruno", apellidos: "Vidal", seccionId: "tropa" }, educandos).semaforo).toBe("RECONOCIDO");
  });

  it("dudoso: la sección no cuadra", () => {
    const r = buscarPersona({ nombre: "Nora", apellidos: "Vidal Soler", seccionId: "tropa" }, educandos);
    expect(r.semaforo).toBe("DUDOSO");
    expect(r.candidatos.map((c) => c.educandoId)).toEqual(["1"]);
  });

  it("dudoso: varios posibles, primero los de su sección", () => {
    const r = buscarPersona({ nombre: "Iker", apellidos: "Molina", seccionId: "tropa" }, educandos);
    expect(r.semaforo).toBe("DUDOSO");
    expect(r.candidatos.map((c) => c.educandoId)).toEqual(["4", "3"]);
  });

  it("sin coincidencia: propone los de su sección con un nombre de pila parecido", () => {
    const r = buscarPersona({ nombre: "Iker", apellidos: "Sanz", seccionId: "manada" }, educandos);
    expect(r).toEqual({ semaforo: "SIN_COINCIDENCIA", candidatos: [educandos[2]] });
  });
});

describe("textoParaExcel", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+34 600", "'+34 600"],
    ["-x", "'-x"],
    ["@a", "'@a"],
    ["Nora", "Nora"],
  ])("%s -> %s", (entrada, salida) => {
    expect(textoParaExcel(entrada)).toBe(salida);
  });
});
