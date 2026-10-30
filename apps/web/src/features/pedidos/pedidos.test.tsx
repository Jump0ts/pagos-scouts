import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";
import type { Articulo, DetallePedido, Envio, FormularioPublico } from "./pedidos.types";
import { describirLinea, precioDe, problemaDe } from "./pedidos.utils";

// Datos inventados. Camiseta con talla y nombre al dorso opcional (+3 €).
const CAMISETA: Articulo = {
  id: "a1",
  nombre: "Camiseta",
  precioCentimos: 1200,
  maxUnidades: 2,
  opciones: [
    {
      id: "o1",
      nombre: "Talla",
      tipo: "LISTA",
      obligatoria: true,
      maxLongitud: null,
      suplementoCentimos: 0,
      valores: [
        { id: "v1", valor: "9/10", suplementoCentimos: 0 },
        { id: "v2", valor: "XL", suplementoCentimos: 200 },
      ],
    },
    { id: "o2", nombre: "Nombre al dorso", tipo: "TEXTO", obligatoria: false, maxLongitud: 12, suplementoCentimos: 300, valores: [] },
  ],
};

describe("cálculo en la web", () => {
  it("precio con suplementos, problemas y descripción, igual que la API", () => {
    const linea = { articuloId: "a1", elecciones: [{ opcionId: "o1", valorId: "v2" }, { opcionId: "o2", texto: "Nora" }] };
    expect(precioDe(CAMISETA, linea)).toBe(1700);
    expect(problemaDe(CAMISETA, linea)).toBeNull();
    expect(problemaDe(CAMISETA, { articuloId: "a1", elecciones: [] })).toBe("Elige talla");
    expect(problemaDe(CAMISETA, { articuloId: "a1", elecciones: [{ opcionId: "o1", valorId: "v1" }, { opcionId: "o2", texto: "=1+1" }] })).toMatch(
      /solo letras/,
    );
    expect(
      describirLinea("Camiseta", [
        { opcion: "Talla", tipo: "LISTA", valor: "XL", suplementoCentimos: 200 },
        { opcion: "Nombre al dorso", tipo: "TEXTO", valor: "Nora", suplementoCentimos: 300 },
      ]),
    ).toBe("Camiseta · XL · Nombre al dorso «Nora»");
  });
});

const CODIGO = "c".repeat(43);
const FORMULARIO: FormularioPublico = {
  grupo: "Grupo Scout Pinar",
  pedido: { nombre: "Sudaderas 2026", fechaFin: "2099-12-31", instruccionesPago: "Bizum al 600 000 000" },
  secciones: [
    { id: "s2", nombre: "Manada" },
    { id: "s3", nombre: "Tropa" },
  ],
  articulos: [CAMISETA],
  ticket: "123.firma",
};

describe("formulario público (D-67)", () => {
  beforeEach(() => window.history.replaceState(null, "", `/pedido#${CODIGO}`));
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("el código va en una cabecera, no en la URL; envía lo elegido y muestra el total y cómo pagar", async () => {
    const usuario = userEvent.setup();
    let enviado: Record<string, unknown> | null = null;
    const api = simularApi({
      "GET /publico/pedido": { cuerpo: FORMULARIO },
      "POST /publico/pedido": (cuerpo) => {
        enviado = cuerpo as Record<string, unknown>;
        return {
          status: 201,
          cuerpo: {
            resumen: {
              nombre: "Nora Vidal",
              lineas: [{ articulo: "Camiseta", elecciones: [{ opcion: "Talla", tipo: "LISTA", valor: "XL", suplementoCentimos: 200 }, { opcion: "Nombre al dorso", tipo: "TEXTO", valor: "Nora", suplementoCentimos: 300 }], importeCentimos: 1700 }],
              totalCentimos: 1700,
            },
            instruccionesPago: "Bizum al 600 000 000",
          },
        };
      },
    });
    renderizar("/pedido");

    expect(await screen.findByRole("heading", { name: "Sudaderas 2026" })).toBeInTheDocument();
    const [url, init] = api.mock.calls[0];
    expect(url).toBe("/api/publico/pedido");
    expect((init?.headers as Record<string, string>)["X-Enlace-Pedido"]).toBe(CODIGO);
    // El campo trampa no se ve ni se alcanza con el teclado.
    expect(document.querySelector('input[name="web"]')).toHaveAttribute("tabindex", "-1");

    await usuario.type(screen.getByLabelText("Nombre"), "Nora");
    await usuario.type(screen.getByLabelText("Apellidos"), "Vidal");
    await usuario.click(screen.getByRole("radio", { name: "Manada" }));
    await usuario.click(screen.getByRole("button", { name: /Añadir/ }));
    await usuario.click(screen.getByRole("radio", { name: /^XL \(\+2,00/ }));
    await usuario.type(screen.getByLabelText(/Nombre al dorso/), "Nora");
    expect(screen.getByText(/17,00/, { selector: "[aria-live]" })).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(await screen.findByRole("heading", { name: "Pedido enviado" })).toBeInTheDocument();
    expect(screen.getByText("Bizum al 600 000 000")).toBeInTheDocument();
    expect(enviado).toEqual({
      enlace: CODIGO,
      ticket: "123.firma",
      web: "",
      nombre: "Nora",
      apellidos: "Vidal",
      seccionId: "s2",
      lineas: [{ articuloId: "a1", elecciones: [{ opcionId: "o1", valorId: "v2" }, { opcionId: "o2", texto: "Nora" }] }],
    });
  });

  it("no envía si falta algo, y dice qué", async () => {
    const usuario = userEvent.setup();
    const api = simularApi({ "GET /publico/pedido": { cuerpo: FORMULARIO } });
    renderizar("/pedido");
    await usuario.click(await screen.findByRole("button", { name: "Enviar pedido" }));
    expect(screen.getAllByText("Escríbelo")).toHaveLength(2);
    expect(screen.getByText("Elige su sección")).toBeInTheDocument();
    expect(screen.getByText("Añade al menos un artículo")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Añadir/ }));
    await usuario.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige talla");
    expect(api.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });

  it("un enlace cerrado o falso muestra el aviso de la API", async () => {
    simularApi({ "GET /publico/pedido": { status: 404, cuerpo: { error: "Este enlace no es válido o el pedido ya no admite encargos." } } });
    renderizar("/pedido");
    expect(await screen.findByRole("alert")).toHaveTextContent("no es válido");
  });
});

const DETALLE: DetallePedido = {
  pedido: {
    id: "p1",
    nombre: "Sudaderas 2026",
    fechaInicio: "2026-01-01",
    fechaFin: "2099-12-31",
    instruccionesPago: null,
    cerrado: false,
    formularioAbierto: true,
    enlace: `https://scouts.example.test/pedido#${CODIGO}`,
    pendientes: 1,
    articulos: [CAMISETA],
  },
  resumen: { debidoCentimos: 0, pagadoCentimos: 0, personas: 0, unidades: 0 },
  personas: [],
  proveedor: { unidades: [], textos: [] },
};
const ENVIO: Envio = {
  id: "e1",
  creadoEn: "2026-10-29T10:00:00.000Z",
  nombre: "Nora",
  apellidos: "Vidal",
  seccionId: "s2",
  lineas: [{ articulo: "Camiseta", elecciones: [{ opcion: "Talla", tipo: "LISTA", valor: "9/10", suplementoCentimos: 0 }], importeCentimos: 1200 }],
  totalCentimos: 1200,
  semaforo: "RECONOCIDO",
  candidatos: [{ educandoId: "ed1", nombre: "Nora", apellidos: "Vidal Soler", seccionId: "s2" }],
  posibleCambio: false,
};

describe("revisar un pedido (D-68)", () => {
  it("lo pendiente sale primero con el semáforo; aceptar manda a quién", async () => {
    const usuario = userEvent.setup();
    const aceptar = vi.fn(() => ({ status: 204 }));
    simularApi({
      "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
      "GET /secciones": { cuerpo: { secciones: SECCIONES } },
      "GET /educandos": { cuerpo: { curso: null, educandos: [] } },
      "GET /pedidos/p1": { cuerpo: DETALLE },
      "GET /pedidos/p1/envios": { cuerpo: { envios: [ENVIO] } },
      "POST /pedidos/p1/envios/e1/aceptar": aceptar,
    });
    renderizar("/eventos/pedidos/p1");

    expect(await screen.findByRole("tab", { name: "Por revisar (1)", selected: true })).toBeInTheDocument();
    expect(screen.getByDisplayValue(DETALLE.pedido.enlace!)).toBeInTheDocument();
    const tarjeta = screen.getByRole("article", { name: "Pedido de Nora Vidal" });
    expect(within(tarjeta).getByText("Reconocido")).toBeInTheDocument();
    expect(within(tarjeta).getByRole("radio", { name: /Nora Vidal Soler/ })).toBeChecked();

    await usuario.click(within(tarjeta).getByRole("button", { name: "Aceptar" }));
    await waitFor(() => expect(aceptar).toHaveBeenCalledWith({ educandoId: "ed1", reemplazar: false }));
  });
});

describe("crear un pedido", () => {
  it("los artículos se añaden al final de la lista y el foco va a su nombre", async () => {
    simularApi({ "GET /auth/yo": { cuerpo: PERFIL_ADMIN }, "GET /secciones": { cuerpo: { secciones: SECCIONES } } });
    renderizar("/eventos/pedidos/nuevo");

    await userEvent.click(await screen.findByRole("button", { name: "Añadir ropa con talla" }));
    await userEvent.click(screen.getByRole("button", { name: "Añadir artículo" }));

    const articulos = screen.getAllByRole("article");
    expect(articulos).toHaveLength(2);
    await waitFor(() => expect(within(articulos[1]).getByLabelText("Artículo")).toHaveFocus());
  });
});
