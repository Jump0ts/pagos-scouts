import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";

// Datos inventados.
const EVENTO = {
  id: "ev1",
  nombre: "Cuota 2026-27",
  tipo: "TODA_SECCION",
  fechaInicio: "2026-09-01",
  fechaFin: "2099-12-31",
  descuentoHermanos: true,
  precioSegundoCentimos: 8500,
  precioTerceroCentimos: 6000,
  precios: SECCIONES.map((s) => ({ seccionId: s.id, importeCentimos: 11000 })),
};
const RESUMEN = { debidoCentimos: 19500, pagadoCentimos: 0, ninos: 2, alDia: 0 };
const DETALLE = {
  evento: EVENTO,
  resumen: RESUMEN,
  excluidos: 0,
  cargos: [
    { id: "c1", educando: { id: "e1", nombre: "Sara", apellidos: "Gil Ferrer" }, seccionId: "s3", importeCentimos: 11000, importeCalculadoCentimos: 11000, ajustado: false, motivoAjuste: null, posicionHermano: 1, pagadoCentimos: 0, estado: "PENDIENTE" },
    { id: "c2", educando: { id: "e2", nombre: "Mateo", apellidos: "Gil Ferrer" }, seccionId: "s2", importeCentimos: 8500, importeCalculadoCentimos: 8500, ajustado: false, motivoAjuste: null, posicionHermano: 2, pagadoCentimos: 0, estado: "PENDIENTE" },
    { id: "c3", educando: { id: "e3", nombre: "Bruno", apellidos: "" }, seccionId: "s1", importeCentimos: 0, importeCalculadoCentimos: 11000, ajustado: true, motivoAjuste: "Ayuda del grupo", posicionHermano: 1, pagadoCentimos: 0, estado: "EXENTO" },
  ],
};
const BASE = {
  "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
  "GET /secciones": { cuerpo: { secciones: SECCIONES } },
  "GET /educandos": { cuerpo: { curso: { id: "c1", nombre: "2026-27" }, educandos: [] } },
};

describe("lista de eventos", () => {
  it("muestra los activos con lo cobrado y pliega los pasados", async () => {
    simularApi({
      ...BASE,
      "GET /eventos": {
        cuerpo: {
          curso: { id: "c1", nombre: "2026-27" },
          eventos: [
            { ...EVENTO, resumen: RESUMEN },
            { ...EVENTO, id: "ev0", nombre: "Acampada de octubre", fechaFin: "2020-10-15", resumen: RESUMEN },
          ],
        },
      },
    });
    renderizar("/eventos");

    const tarjeta = (await screen.findByText("Cuota 2026-27")).closest("a")!;
    expect(tarjeta).toHaveAttribute("href", "/eventos/ev1");
    expect(within(tarjeta).getByText("0/2 al día")).toBeInTheDocument();
    expect(screen.getByText("Pasados (1)")).toBeInTheDocument();
  });
});

describe("crear un evento", () => {
  it("envía precios por sección y de hermanos en céntimos", async () => {
    let enviado: unknown;
    simularApi({
      ...BASE,
      "POST /eventos": (cuerpo) => {
        enviado = cuerpo;
        return { status: 201, cuerpo: { evento: { id: "ev9" } } };
      },
      "GET /eventos/ev9": { cuerpo: DETALLE },
    });
    const app = renderizar("/eventos/nuevo");

    await userEvent.type(await screen.findByLabelText("Nombre"), "Cuota 2026-27");
    await userEvent.clear(screen.getByLabelText("Desde"));
    await userEvent.type(screen.getByLabelText("Desde"), "2026-09-01");
    await userEvent.type(screen.getByLabelText("Hasta"), "2027-06-30");
    for (const nombre of ["Castores", "Manada", "Tropa"]) {
      await userEvent.click(screen.getByRole("checkbox", { name: nombre }));
    }
    await userEvent.type(screen.getByLabelText("Mismo precio para todas"), "110");
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Precio de hermanos/ }));
    await userEvent.type(screen.getByLabelText("2º hermano"), "85");
    await userEvent.type(screen.getByLabelText("3º y siguientes (opcional)"), "60,50");
    await userEvent.click(screen.getByRole("button", { name: "Crear evento" }));

    await waitFor(() => expect(app.ruta()).toBe("/eventos/ev9"));
    expect(enviado).toEqual({
      nombre: "Cuota 2026-27",
      tipo: "TODA_SECCION",
      fechaInicio: "2026-09-01",
      fechaFin: "2027-06-30",
      precios: [
        { seccionId: "s1", importeCentimos: 11000 },
        { seccionId: "s2", importeCentimos: 11000 },
        { seccionId: "s3", importeCentimos: 11000 },
      ],
      descuentoHermanos: true,
      precioSegundoCentimos: 8500,
      precioTerceroCentimos: 6050,
      apuntados: [],
    });
  });

  it("avisa de importes mal escritos y de que falta elegir sección", async () => {
    simularApi(BASE);
    renderizar("/eventos/nuevo");

    await userEvent.type(await screen.findByLabelText("Nombre"), "Censo");
    await userEvent.type(screen.getByLabelText("Hasta"), "2027-06-30");
    await userEvent.click(screen.getByRole("button", { name: "Crear evento" }));
    expect(await screen.findByText("Elige al menos una sección")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Tropa" }));
    await userEvent.type(screen.getByLabelText("Precio para Tropa"), "cuarenta");
    await userEvent.click(screen.getByRole("button", { name: "Crear evento" }));
    expect(await screen.findByText("Escribe un importe, por ejemplo 85 o 85,50")).toBeInTheDocument();
  });
});

describe("detalle del evento", () => {
  it("agrupa por sección, filtra por estado y muestra hermanos y ajustes", async () => {
    simularApi({ ...BASE, "GET /eventos/ev1": { cuerpo: DETALLE } });
    renderizar("/eventos/ev1");

    expect(await screen.findByRole("heading", { name: "Cuota 2026-27" })).toBeInTheDocument();
    expect(screen.getByText("2º hermano")).toBeInTheDocument();
    expect(screen.getByText("Ajustado: Ayuda del grupo")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Exentos" }));
    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(screen.queryByText("Sara")).not.toBeInTheDocument();
  });

  it("ajusta el importe de un niño con su motivo", async () => {
    let enviado: unknown;
    simularApi({
      ...BASE,
      "GET /eventos/ev1": { cuerpo: DETALLE },
      "PATCH /eventos/ev1/cargos/c2": (cuerpo) => {
        enviado = cuerpo;
        return { status: 204 };
      },
    });
    renderizar("/eventos/ev1");

    await userEvent.click(await screen.findByRole("button", { name: "Acciones para Mateo" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Ajustar importe" }));
    const dialogo = await screen.findByRole("dialog", { name: "Importe de Mateo" });
    await userEvent.clear(within(dialogo).getByLabelText("Importe"));
    await userEvent.type(within(dialogo).getByLabelText("Importe"), "40");
    await userEvent.type(within(dialogo).getByLabelText("Motivo (opcional)"), "Acuerdo con la familia");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(enviado).toEqual({ importeAjustadoCentimos: 4000, motivo: "Acuerdo con la familia" }),
    );
  });

  it("un scouter ve estados e importes pero no gestiona", async () => {
    simularApi({
      ...BASE,
      "GET /auth/yo": { cuerpo: { ...PERFIL_ADMIN, grupoActivo: { ...PERFIL_ADMIN.grupoActivo, rol: "SCOUTER" } } },
      "GET /eventos/ev1": { cuerpo: { ...DETALLE, cargos: DETALLE.cargos.map(({ motivoAjuste: _, ...c }) => c) } },
    });
    renderizar("/eventos/ev1");

    expect(await screen.findByText("Sara")).toBeInTheDocument();
    expect(screen.getByText("Ajustado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Acciones para/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Editar/ })).not.toBeInTheDocument();
  });
});
