import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";

// Datos inventados.
const CLASIFICADO = {
  id: "m1",
  origen: "BANCO",
  fecha: "2026-10-01",
  concepto: "FERRER SOTO LUCIA",
  importeCentimos: 19500,
  estado: "CLASIFICADO",
  motivo: null,
  familia: { id: "f1", nombre: "Familia Gil Ferrer" },
  cargos: [
    { cargoId: "c1", evento: "Cuota", educando: "Sara", importeCentimos: 11000 },
    { cargoId: "c2", evento: "Cuota", educando: "Mateo", importeCentimos: 8500 },
  ],
  clasificadoPor: null,
  clasificadoEn: "2026-10-27T10:00:00.000Z",
};
const DUDA = {
  ...CLASIFICADO,
  id: "m2",
  concepto: "LUCIA FERRER SOTO",
  importeCentimos: 3000,
  estado: "DUDA",
  motivo: "VARIAS_COMBINACIONES",
  cargos: [{ cargoId: "c3", evento: "Censo", educando: "Sara", importeCentimos: 3000 }],
  clasificadoEn: null,
};
const CONTADORES = { dudas: 1, clasificados: 1, otros: 0 };
const BASE = {
  "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
  "GET /secciones": { cuerpo: { secciones: SECCIONES } },
  "GET /movimientos?estado=DUDA": { cuerpo: { contadores: CONTADORES, movimientos: [DUDA] } },
  "GET /movimientos?estado=CLASIFICADO": { cuerpo: { contadores: CONTADORES, movimientos: [CLASIFICADO] } },
};

describe("pantalla Movimientos", () => {
  it("muestra las dudas con su motivo y la sugerencia, y los clasificados con lo que pagan", async () => {
    simularApi(BASE);
    renderizar("/movimientos");

    const duda = (await screen.findByText("LUCIA FERRER SOTO")).closest("li")!;
    expect(within(duda).getByText("Varias opciones")).toBeInTheDocument();
    expect(within(duda).getByText(/Censo de Sara/)).toBeInTheDocument();
    expect(within(duda).queryByRole("button", { name: /Deshacer/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Clasificados/ }));
    const fila = (await screen.findByText("FERRER SOTO LUCIA")).closest("li")!;
    expect(within(fila).getByText("Automático")).toBeInTheDocument();
    expect(within(fila).getByText(/Cuota de Sara \(110,00\s€\), Cuota de Mateo \(85,00\s€\)/)).toBeInTheDocument();
  });

  it("deshace una clasificación tras confirmarlo", async () => {
    const api = simularApi({ ...BASE, "POST /movimientos/m1/deshacer": { status: 204 } });
    renderizar("/movimientos?ver=clasificados");

    await userEvent.click(await screen.findByRole("button", { name: /Deshacer FERRER SOTO LUCIA/ }));
    const dialogo = await screen.findByRole("alertdialog", { name: "¿Deshacer esta clasificación?" });
    await userEvent.click(within(dialogo).getByRole("button", { name: "Deshacer" }));

    await waitFor(() => expect(api).toHaveBeenCalledWith("/api/movimientos/m1/deshacer", expect.objectContaining({ method: "POST" })));
  });

  it("un scouter no ve la entrada Movimientos", async () => {
    simularApi({
      ...BASE,
      "GET /auth/yo": { cuerpo: { ...PERFIL_ADMIN, grupoActivo: { ...PERFIL_ADMIN.grupoActivo, rol: "SCOUTER" } } },
      "GET /eventos": { cuerpo: { curso: null, eventos: [] } },
    });
    renderizar("/eventos");

    expect(await screen.findAllByRole("link", { name: /Eventos/ })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: /Movimientos/ })).not.toBeInTheDocument();
  });
});

describe("importar del banco", () => {
  const RESUMEN = {
    nuevos: 2,
    yaImportados: 3,
    salidasIgnoradas: 1,
    clasificados: 1,
    dudas: 1,
    desde: "2026-10-01",
    hasta: "2026-10-03",
    movimientos: [CLASIFICADO, DUDA].map(({ id: _, origen: __, clasificadoPor: ___, clasificadoEn: ____, ...m }) => m),
  };

  it("analiza, enseña qué pasará y confirma con el mismo fichero", async () => {
    const subidos: unknown[] = [];
    simularApi({
      ...BASE,
      "POST /movimientos/importar/analizar": (cuerpo) => {
        subidos.push(cuerpo);
        return { cuerpo: RESUMEN };
      },
      "POST /movimientos/importar/confirmar": (cuerpo) => {
        subidos.push(cuerpo);
        return { status: 201, cuerpo: RESUMEN };
      },
    });
    renderizar("/movimientos/importar");

    const archivo = new File(["contenido"], "Movimientos.xls");
    await userEvent.upload(await screen.findByLabelText(/Elige el Excel de movimientos/), archivo);

    const resumen = await screen.findByText("Se clasifican solos", { selector: "dt" });
    expect(resumen.nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Ya importados").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText(/ingresos del 1 oct al 3 oct/)).toBeInTheDocument();
    const dudas = screen.getByRole("region", { name: "Irán a Dudas" });
    expect(within(dudas).getByText("LUCIA FERRER SOTO")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Se clasifican solos" })).getByText("Se clasifica solo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Importar 2 ingresos/ }));

    expect(await screen.findByRole("heading", { name: "Movimientos importados" })).toBeInTheDocument();
    expect(screen.getByText(/2 ingresos nuevos: 1 clasificado solo y 1 en Dudas/)).toBeInTheDocument();
    expect(subidos).toEqual([archivo, archivo]);
  });

  it("si no hay nada nuevo, no deja importar", async () => {
    simularApi({
      ...BASE,
      "POST /movimientos/importar/analizar": { cuerpo: { ...RESUMEN, nuevos: 0, clasificados: 0, dudas: 0, movimientos: [] } },
    });
    renderizar("/movimientos/importar");

    await userEvent.upload(await screen.findByLabelText(/Elige el Excel de movimientos/), new File(["x"], "Movimientos.xls"));

    expect(await screen.findByText(/No hay ingresos nuevos/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Importar \d/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir otro fichero" })).toBeInTheDocument();
  });
});
