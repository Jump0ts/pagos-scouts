import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";

// Propuesta inventada como la que devuelve la API.
const ANALISIS = {
  bloques: [
    { indice: 0, total: 2, ejemplos: ["Mateo Gil Ferrer", "Bruno"] },
    { indice: 1, total: 1, ejemplos: ["Sara Gil Ferrer"] },
  ],
  familias: [
    {
      clave: "familia-1",
      nombre: "Familia Gil Ferrer",
      responsables: ["Lucía Ferrer Soto"],
      existenteId: null,
      avisos: [],
      ninos: [
        { clave: "f2", bloque: 0, nombre: "Mateo", apellidos: "Gil Ferrer", existenteId: null, seccionActualId: null, pagado: [] },
        { clave: "f5", bloque: 1, nombre: "Sara", apellidos: "Gil Ferrer", existenteId: null, seccionActualId: null, pagado: ["PAGO DEL CENSO"] },
      ],
    },
    {
      clave: "familia-2",
      nombre: "Familia de Bruno",
      responsables: [],
      existenteId: null,
      avisos: ["Sin responsables: sus pagos no se podrán reconocer por el nombre de quien paga"],
      ninos: [{ clave: "f3", bloque: 0, nombre: "Bruno", apellidos: "", existenteId: null, seccionActualId: null, pagado: [] }],
    },
  ],
  columnasIgnoradas: ["Pago del censo", "Observaciones"],
  columnasPago: [{ clave: "PAGO DEL CENSO", titulo: "Pago del censo", marcas: 1 }],
  noAparecen: [],
  cursoSugerido: "2026-27",
};

describe("asistente de importación", () => {
  it("sube el fichero, asigna secciones y eventos de las marcas, deja quitar a un niño y envía la propuesta", async () => {
    let enviado: unknown;
    let subido: unknown;
    simularApi({
      "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
      "GET /secciones": { cuerpo: { secciones: SECCIONES } },
      "GET /eventos": { cuerpo: { curso: { id: "c1", nombre: "2026-27" }, eventos: [{ id: "ev1", nombre: "Censo" }] } },
      "POST /importaciones/listado/analizar": () => ({ cuerpo: ANALISIS }),
      "POST /importaciones/listado/confirmar": (cuerpo) => {
        enviado = cuerpo;
        const marcas = { marcasImportadas: 1, marcasSinCargo: 0, marcasYaPagadas: 0 };
        return { status: 201, cuerpo: { curso: { id: "c1", nombre: "2026-27" }, familiasNuevas: 1, ninosNuevos: 2, ninosActualizados: 0, ...marcas } };
      },
    });
    const fetchOriginal = globalThis.fetch;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url.endsWith("/analizar")) subido = init?.body;
      return fetchOriginal(url, init);
    });
    renderizar("/educandos/importar");

    const archivo = new File(["contenido"], "listado.xlsx");
    await userEvent.upload(await screen.findByLabelText(/Elige el Excel del listado/), archivo);
    expect(subido).toBe(archivo);

    expect(await screen.findByText(/2 bloques con/)).toBeInTheDocument();
    expect(screen.getByText("Se ignoran estas columnas: Observaciones.")).toBeInTheDocument();
    await userEvent.selectOptions(await screen.findByLabelText("Evento de la columna Pago del censo"), "ev1");
    expect(screen.getByRole("button", { name: "Faltan 2 bloques" })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Sección del bloque 1"), "s2");
    await userEvent.selectOptions(screen.getByLabelText("Sección del bloque 2"), "s3");
    await userEvent.click(screen.getByRole("button", { name: "Revisar familias" }));

    expect(await screen.findByText(/Sin responsables: sus pagos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Importar a Bruno" }));
    await userEvent.click(screen.getByRole("button", { name: /Importar 2 niños/ }));

    expect(await screen.findByRole("heading", { name: "Listado importado" })).toBeInTheDocument();
    expect(screen.getByText(/Marcas «Pagado»: 1 apuntadas como pagos/)).toBeInTheDocument();
    expect(enviado).toEqual({
      curso: "2026-27",
      secciones: { 0: "s2", 1: "s3" },
      familias: [
        {
          existenteId: null,
          nombre: "Familia Gil Ferrer",
          responsables: ["Lucía Ferrer Soto"],
          ninos: [
            { existenteId: null, nombre: "Mateo", apellidos: "Gil Ferrer", bloque: 0, pagado: [] },
            { existenteId: null, nombre: "Sara", apellidos: "Gil Ferrer", bloque: 1, pagado: ["PAGO DEL CENSO"] },
          ],
        },
      ],
      columnasPago: [{ clave: "PAGO DEL CENSO", titulo: "Pago del censo", eventoId: "ev1" }],
    });
  });

  it("muestra el error si el fichero no se puede leer", async () => {
    simularApi({
      "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
      "GET /secciones": { cuerpo: { secciones: SECCIONES } },
      "POST /importaciones/listado/analizar": { status: 400, cuerpo: { error: "No se ha podido leer el fichero." } },
    });
    renderizar("/educandos/importar");

    await userEvent.upload(await screen.findByLabelText(/Elige el Excel del listado/), new File(["x"], "roto.xlsx"));

    expect(await screen.findByText("No se ha podido leer el fichero.")).toBeInTheDocument();
  });
});
