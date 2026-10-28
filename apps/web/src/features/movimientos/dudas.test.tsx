import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";

// Datos inventados. Una duda de 50 € de "LUCIA FERRER SOTO" con la familia Gil Ferrer sugerida: Sara y Mateo, cada
// uno con el censo (30 €) pendiente.
const DUDA = {
  id: "m2",
  origen: "BANCO",
  fecha: "2026-10-03",
  concepto: "LUCIA FERRER SOTO",
  importeCentimos: 5000,
  estado: "DUDA",
  motivo: "VARIAS_COMBINACIONES",
  medio: null,
  nota: null,
  familia: { id: "f1", nombre: "Familia Gil Ferrer" },
  cargos: [{ cargoId: "c3", evento: "Censo", educando: "Sara", importeCentimos: 3000 }],
  sobranteCentimos: 0,
  cruce: null,
  clasificadoPor: null,
  clasificadoEn: null,
};
const censo = (id: string) => ({ id, evento: { id: "ev2", nombre: "Censo" }, importeCentimos: 3000, pagadoCentimos: 0, estado: "PENDIENTE" });
const FICHA = {
  id: "f1",
  nombre: "Familia Gil Ferrer",
  responsables: [{ id: "r1", nombreCompleto: "Lucía Ferrer Soto" }],
  educandos: [
    { id: "e1", nombre: "Sara", apellidos: "Gil Ferrer", fechaNacimiento: null, seccionId: "s3", deBaja: false, cargos: [censo("c3")] },
    { id: "e2", nombre: "Mateo", apellidos: "Gil Ferrer", fechaNacimiento: null, seccionId: "s2", deBaja: false, cargos: [censo("c4")] },
  ],
  pagos: [],
  saldoCentimos: 0,
  pagadores: [],
};
const familia = { id: "f1", nombre: "Familia Gil Ferrer" };
const CONTADORES = { dudas: 1, clasificados: 0, otros: 0 };
const BASE = {
  "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
  "GET /secciones": { cuerpo: { secciones: SECCIONES } },
  "GET /familias/f1": { cuerpo: { familia: FICHA } },
  "GET /educandos": {
    cuerpo: {
      curso: { id: "c1", nombre: "2026-27" },
      educandos: [
        { id: "e1", nombre: "Sara", apellidos: "Gil Ferrer", seccionId: "s3", familia },
        { id: "e2", nombre: "Mateo", apellidos: "Gil Ferrer", seccionId: "s2", familia },
      ],
    },
  },
  "GET /movimientos?estado=DUDA": { cuerpo: { contadores: CONTADORES, movimientos: [DUDA] } },
  "GET /movimientos?estado=CLASIFICADO": { cuerpo: { contadores: CONTADORES, movimientos: [] } },
  "GET /movimientos?estado=OTRO_INGRESO": { cuerpo: { contadores: CONTADORES, movimientos: [] } },
};

describe("resolver una duda", () => {
  it("parte de la sugerencia, avisa si el reparto se pasa y envía el reparto y el pagador a recordar", async () => {
    let enviado: unknown;
    simularApi({
      ...BASE,
      "GET /movimientos/m2": { cuerpo: { movimiento: DUDA, pagadorConocido: null, candidatosCruce: [] } },
      "POST /movimientos/m2/resolver": (cuerpo) => {
        enviado = cuerpo;
        return { cuerpo: { reintentadas: 1 } };
      },
    });
    const app = renderizar("/movimientos/m2");

    expect(await screen.findByText("Varias opciones.")).toBeInTheDocument();
    expect(await screen.findByLabelText("Importe para Censo de Sara")).toHaveValue("30");
    await userEvent.click(screen.getByRole("button", { name: /Censo.*Pendiente 30,00/, pressed: false }));
    expect(await screen.findByText(/El reparto pasa del pago en 10,00/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText("Importe para Censo de Mateo"));
    await userEvent.type(screen.getByLabelText("Importe para Censo de Mateo"), "20");
    expect(screen.getByRole("checkbox", { name: /Recordar «LUCIA FERRER SOTO»/ })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(app.ruta()).toBe("/movimientos"));
    expect(enviado).toEqual({
      familiaId: "f1",
      asignaciones: [
        { cargoId: "c3", importeCentimos: 3000 },
        { cargoId: "c4", importeCentimos: 2000 },
      ],
      recordarPagador: true,
    });
    expect(await screen.findByText(/Además, 1 pago más de LUCIA FERRER SOTO/)).toBeInTheDocument();
  });

  it("ofrece cruzarla con un pago apuntado a mano del mismo importe", async () => {
    let enviado: unknown;
    simularApi({
      ...BASE,
      "GET /movimientos/m2": {
        cuerpo: {
          movimiento: { ...DUDA, motivo: "POSIBLE_YA_APUNTADO", cargos: [] },
          pagadorConocido: { familiaId: "f1" },
          candidatosCruce: [{ id: "m9", origen: "MANUAL", fecha: "2026-10-01", concepto: "Lucía en la reunión", medio: "EFECTIVO", importeCentimos: 5000 }],
        },
      },
      "POST /movimientos/m2/cruzar": (cuerpo) => {
        enviado = cuerpo;
        return { status: 204 };
      },
    });
    const app = renderizar("/movimientos/m2");

    expect(await screen.findByText(/Apuntado a mano · Efectivo/)).toBeInTheDocument();
    // El pagador ya está aprendido para esta familia: no se ofrece recordarlo otra vez.
    await screen.findByLabelText("Buscar a un niño");
    expect(screen.queryByRole("checkbox", { name: /Recordar/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Es el mismo pago" }));

    await waitFor(() => expect(app.ruta()).toBe("/movimientos"));
    expect(enviado).toEqual({ movimientoId: "m9" });
  });

  it("la saca de Dudas como otro ingreso, con su nota", async () => {
    let enviado: unknown;
    simularApi({
      ...BASE,
      "GET /movimientos/m2": {
        cuerpo: { movimiento: { ...DUDA, familia: null, cargos: [], motivo: "PAGADOR_DESCONOCIDO" }, pagadorConocido: null, candidatosCruce: [] },
      },
      "POST /movimientos/m2/otro-ingreso": (cuerpo) => {
        enviado = cuerpo;
        return { status: 204 };
      },
    });
    const app = renderizar("/movimientos/m2");

    expect(await screen.findByText("Busca a un niño para ver las deudas de su familia.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: /No es de familias/ }));
    const dialogo = await screen.findByRole("dialog", { name: "No es de ninguna familia" });
    await userEvent.type(within(dialogo).getByLabelText("Nota (opcional)"), "Subvención");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(app.ruta()).toBe("/movimientos"));
    expect(enviado).toEqual({ nota: "Subvención" });
  });
});

describe("pago a mano", () => {
  it("busca la familia por un niño, reparte y envía el pago; lo que sobra queda como saldo", async () => {
    let enviado: Record<string, unknown> = {};
    simularApi({
      ...BASE,
      "POST /movimientos": (cuerpo) => {
        enviado = cuerpo as Record<string, unknown>;
        return { status: 201, cuerpo: { movimiento: { id: "m10" } } };
      },
    });
    const app = renderizar("/movimientos/nuevo");

    await userEvent.click(await screen.findByRole("button", { name: /Apuntar pago/ }));
    expect(await screen.findByText("Escribe quién ha pagado")).toBeInTheDocument();
    expect(screen.getByText(/Elige la familia que paga/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Quién ha pagado"), "Lucía en la reunión");
    await userEvent.type(screen.getByLabelText("Importe"), "40");
    await userEvent.click(screen.getByRole("radio", { name: "Bizum" }));
    await userEvent.type(screen.getByLabelText("Buscar a un niño"), "sára");
    await userEvent.click(await screen.findByRole("button", { name: /Sara Gil Ferrer/ }));
    await userEvent.click((await screen.findAllByRole("button", { name: /Censo.*Pendiente 30,00/ }))[0]);
    expect(screen.getByText(/10,00\s€ quedarán como saldo a favor de Familia Gil Ferrer/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Apuntar pago/ }));

    await waitFor(() => expect(app.ruta()).toBe("/movimientos"));
    expect(enviado).toMatchObject({
      concepto: "Lucía en la reunión",
      importeCentimos: 4000,
      medio: "BIZUM",
      familiaId: "f1",
      asignaciones: [{ cargoId: "c3", importeCentimos: 3000 }],
    });
    expect(enviado.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("inicio", () => {
  it("enseña cuántas dudas quedan por resolver", async () => {
    simularApi(BASE);
    renderizar("/");
    expect(await screen.findByRole("link", { name: /1 duda por resolver/ })).toHaveAttribute("href", "/movimientos");
  });
});
