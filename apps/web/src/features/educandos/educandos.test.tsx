import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";

// Datos inventados.
const LISTA = {
  curso: { id: "c1", nombre: "2026-27" },
  educandos: [
    { id: "e1", nombre: "Mateo", apellidos: "Gil Ferrer", seccionId: "s1", familia: { id: "f1", nombre: "Familia Gil Ferrer" } },
    { id: "e2", nombre: "Sara", apellidos: "Gil Ferrer", seccionId: "s2", familia: { id: "f1", nombre: "Familia Gil Ferrer" } },
    { id: "e3", nombre: "Íñigo", apellidos: "Navas Vidal", seccionId: "s2", familia: { id: "f2", nombre: "Familia Navas Vidal" } },
  ],
};
const FICHA = {
  id: "f1",
  nombre: "Familia Gil Ferrer",
  responsables: [{ id: "r1", nombreCompleto: "Lucía Ferrer Soto" }],
  educandos: [
    { id: "e1", nombre: "Mateo", apellidos: "Gil Ferrer", fechaNacimiento: null, seccionId: "s1", deBaja: false },
    { id: "e2", nombre: "Sara", apellidos: "Gil Ferrer", fechaNacimiento: null, seccionId: "s2", deBaja: false },
  ],
};
const BASE = {
  "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
  "GET /secciones": { cuerpo: { secciones: SECCIONES } },
  "GET /educandos": { cuerpo: LISTA },
};

describe("pantalla Educandos", () => {
  it("agrupa por sección, busca sin tildes y filtra por sección", async () => {
    simularApi(BASE);
    renderizar("/educandos");

    expect(await screen.findByText("Curso 2026-27 · 3 niños")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Castores · 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Manada · 2" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox"), "inigo");
    expect(screen.getByText("Íñigo")).toBeInTheDocument();
    expect(screen.queryByText("Mateo")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.click(screen.getByRole("button", { name: "Castores" }));
    expect(screen.getByText("Mateo")).toBeInTheDocument();
    expect(screen.queryByText("Sara")).not.toBeInTheDocument();
  });

  it("al tocar a un niño abre la ficha de su familia con sus hermanos y responsables", async () => {
    simularApi({ ...BASE, "GET /familias/f1": { cuerpo: { familia: FICHA } } });
    renderizar("/educandos");

    await userEvent.click(await screen.findByRole("button", { name: /Sara Gil Ferrer: abrir la ficha/ }));

    const ficha = await screen.findByRole("dialog", { name: "Familia Gil Ferrer" });
    expect(await within(ficha).findByText("Lucía Ferrer Soto")).toBeInTheDocument();
    expect(within(ficha).getByText("Mateo Gil Ferrer")).toBeInTheDocument();
    expect(within(ficha).getByText("Sara Gil Ferrer")).toBeInTheDocument();
  });

  it("un scouter ve la lista pero no abre fichas ni ve los botones de gestión", async () => {
    simularApi({
      ...BASE,
      "GET /auth/yo": { cuerpo: { ...PERFIL_ADMIN, grupoActivo: { ...PERFIL_ADMIN.grupoActivo, rol: "SCOUTER" } } },
      "GET /educandos": { cuerpo: { curso: LISTA.curso, educandos: LISTA.educandos.map(({ familia: _, ...e }) => e) } },
    });
    renderizar("/educandos");

    expect(await screen.findByText("Mateo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /abrir la ficha/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Importar listado" })).not.toBeInTheDocument();
  });

  it("sin nadie todavía, invita a importar el listado", async () => {
    simularApi({ ...BASE, "GET /educandos": { cuerpo: { curso: null, educandos: [] } } });
    renderizar("/educandos");

    expect(await screen.findByRole("heading", { name: "Aún no hay educandos" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Importar listado/ })).toHaveLength(2);
  });

  it("da de alta a un niño en una familia nueva con sus responsables", async () => {
    let enviado: unknown;
    simularApi({
      ...BASE,
      "POST /educandos": (cuerpo) => {
        enviado = cuerpo;
        return { status: 201, cuerpo: { educando: { id: "e9", familiaId: "f9" } } };
      },
      "GET /familias/f9": { cuerpo: { familia: { ...FICHA, id: "f9" } } },
    });
    renderizar("/educandos");

    await userEvent.click(await screen.findByRole("button", { name: "Añadir" }));
    const dialogo = await screen.findByRole("dialog", { name: "Añadir educando" });
    await userEvent.type(within(dialogo).getByLabelText("Nombre"), "Leo");
    await userEvent.type(within(dialogo).getByLabelText("Apellidos"), "Díaz Castillo");
    await userEvent.click(within(dialogo).getByRole("radio", { name: "Tropa" }));
    await userEvent.type(within(dialogo).getByLabelText("Responsable 1"), "Rosa Castillo Rojo");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Añadir" }));

    await screen.findByRole("dialog", { name: "Familia Gil Ferrer" });
    expect(enviado).toEqual({
      nombre: "Leo",
      apellidos: "Díaz Castillo",
      fechaNacimiento: null,
      seccionId: "s3",
      familia: { nueva: { responsables: ["Rosa Castillo Rojo"] } },
    });
  });
});
