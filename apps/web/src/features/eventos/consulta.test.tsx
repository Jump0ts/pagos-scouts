import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";
import type { CargoVista } from "./eventos.types";
import { textoRecordatorio } from "./eventos.utils";

// Datos inventados. Campamento en Tropa: Sara y Saúl comparten inicial (G.), Vera ha pagado a medias e Irene ya ha
// pagado.
const cargo = (id: string, nombre: string, apellidos: string, estado: CargoVista["estado"], pagadoCentimos = 0): CargoVista => ({
  id,
  educando: { id: `e-${id}`, nombre, apellidos },
  seccionId: "s3",
  importeCentimos: 11000,
  importeCalculadoCentimos: 11000,
  ajustado: false,
  motivoAjuste: null,
  posicionHermano: 1,
  pagadoCentimos,
  estado,
});
const CARGOS = [
  cargo("c1", "Sara", "Gil Ferrer", "PENDIENTE"),
  cargo("c2", "Sara", "Galindo Ochoa", "PENDIENTE"),
  cargo("c3", "Vera", "Quiroga Ibáñez", "PARCIAL", 6000),
  cargo("c4", "Irene", "Navas Vidal", "PAGADO", 11000),
];
const EVENTO = {
  id: "ev1",
  nombre: "Campamento de verano",
  tipo: "CON_APUNTADOS",
  fechaInicio: "2027-07-01",
  fechaFin: "2099-07-15",
  descuentoHermanos: false,
  precioSegundoCentimos: null,
  precioTerceroCentimos: null,
  precios: [{ seccionId: "s3", importeCentimos: 11000 }],
};
const RESUMEN = { debidoCentimos: 44000, pagadoCentimos: 17000, ninos: 4, alDia: 1 };
const BASE = {
  "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
  "GET /secciones": { cuerpo: { secciones: SECCIONES } },
  "GET /eventos/ev1": { cuerpo: { evento: EVENTO, resumen: RESUMEN, excluidos: 0, cargos: CARGOS } },
};

describe("recordatorio para copiar (D-58)", () => {
  it("nombre e inicial, apellidos completos si coinciden, «a medias» y sin importes", () => {
    expect(textoRecordatorio("Campamento de verano", "Tropa", CARGOS)).toBe(
      [
        "📌 Campamento de verano (Tropa)",
        "Faltan por pagar:",
        "• Sara Gil Ferrer",
        "• Sara Galindo Ochoa",
        "• Vera Q. (a medias)",
        "",
        "Si ya lo habéis pagado, avisadnos. ¡Gracias!",
      ].join("\n"),
    );
  });

  it("sale de lo filtrado y se puede copiar", async () => {
    simularApi(BASE);
    renderizar("/eventos/ev1");

    await userEvent.click(await screen.findByRole("button", { name: "A medias" }));
    await userEvent.click(screen.getByRole("button", { name: /Recordatorio/ }));

    const dialogo = await screen.findByRole("dialog", { name: "Recordatorio de pago" });
    const texto = within(dialogo).getByLabelText("Texto del recordatorio");
    expect(texto).toHaveValue("📌 Campamento de verano (Tropa)\nFaltan por pagar:\n• Vera Q. (a medias)\n\nSi ya lo habéis pagado, avisadnos. ¡Gracias!");
    expect(within(dialogo).getByText(/1 niño con los filtros/)).toBeInTheDocument();
  });

  it("no se ofrece si con el filtro no falta nadie", async () => {
    simularApi(BASE);
    renderizar("/eventos/ev1");
    await userEvent.click(await screen.findByRole("button", { name: "Pagados" }));
    expect(screen.getByRole("button", { name: /Recordatorio/ })).toBeDisabled();
  });
});

describe("descargar el Excel (D-54)", () => {
  it("pide el evento con los filtros que se ven", async () => {
    // jsdom no crea URLs de blobs ni descarga ficheros.
    const crear = vi.fn(() => "blob:excel");
    Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() });
    const guardar = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const api = simularApi({ ...BASE, "GET /eventos/ev1/exportar?estado=PENDIENTE": { cuerpo: {} } });
    renderizar("/eventos/ev1");

    await userEvent.click(await screen.findByRole("button", { name: "Pendientes" }));
    await userEvent.click(screen.getByRole("button", { name: /Descargar Excel/ }));

    await waitFor(() => expect(guardar).toHaveBeenCalled());
    expect(crear).toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith("/api/eventos/ev1/exportar?estado=PENDIENTE", expect.anything());
  });
});

describe("pagos de un niño (D-56)", () => {
  it("tocar a un niño enseña qué pagos cubren su cargo", async () => {
    simularApi({
      ...BASE,
      "GET /eventos/ev1/cargos/c3/pagos": {
        cuerpo: {
          pagos: [
            { movimientoId: "m1", origen: "MANUAL", fecha: "2026-10-02", concepto: "Pago en la reunión", medio: "EFECTIVO", importeCentimos: 4000, cruce: null },
            { movimientoId: "m2", origen: "BANCO", fecha: "2026-10-05", concepto: "QUIROGA IBAÑEZ OLVIDO", medio: null, importeCentimos: 2000, cruce: { origen: "LISTADO", medio: null } },
          ],
        },
      },
    });
    renderizar("/eventos/ev1");

    await userEvent.click(await screen.findByRole("button", { name: /Vera Quiroga Ibáñez/ }));

    const dialogo = await screen.findByRole("dialog", { name: "Vera Quiroga Ibáñez" });
    expect(within(dialogo).getByText(/60,00\s€ pagado de 110,00\s€ · faltan 50,00\s€/)).toBeInTheDocument();
    expect(await within(dialogo).findByText("Pago en la reunión")).toBeInTheDocument();
    expect(within(dialogo).getByText(/A mano · Efectivo · 2 de octubre de 2026/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Es el mismo dinero que la marca del listado/)).toBeInTheDocument();
  });

  it("un scouter no puede abrirlos", async () => {
    simularApi({ ...BASE, "GET /auth/yo": { cuerpo: { ...PERFIL_ADMIN, grupoActivo: { ...PERFIL_ADMIN.grupoActivo, rol: "SCOUTER" } } } });
    renderizar("/eventos/ev1");

    expect(await screen.findByText("Quiroga Ibáñez")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vera Quiroga Ibáñez/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Descargar Excel/ })).toBeInTheDocument();
  });
});

describe("inicio (D-57)", () => {
  it("enseña los eventos abiertos o con algo pendiente, no los cerrados y cobrados", async () => {
    const cerrado = { ...EVENTO, id: "ev2", nombre: "Acampada de otoño", fechaFin: "2026-10-12" };
    simularApi({
      ...BASE,
      "GET /movimientos?estado=DUDA": { cuerpo: { contadores: { dudas: 0, clasificados: 0, otros: 0 }, movimientos: [] } },
      "GET /eventos": {
        cuerpo: {
          curso: { id: "c1", nombre: "2026-27" },
          eventos: [
            { ...EVENTO, resumen: RESUMEN },
            { ...cerrado, resumen: { debidoCentimos: 3000, pagadoCentimos: 3000, ninos: 1, alDia: 1 } },
            { ...cerrado, id: "ev3", nombre: "Censo", resumen: { debidoCentimos: 3000, pagadoCentimos: 0, ninos: 1, alDia: 0 } },
          ],
        },
      },
    });
    renderizar("/");

    const seccion = await screen.findByRole("region", { name: "Eventos en marcha" });
    expect(within(seccion).getByRole("link", { name: /Campamento de verano/ })).toHaveAttribute("href", "/eventos/ev1");
    expect(within(seccion).getByRole("link", { name: /Censo/ })).toBeInTheDocument();
    expect(within(seccion).queryByText("Acampada de otoño")).not.toBeInTheDocument();
  });
});
