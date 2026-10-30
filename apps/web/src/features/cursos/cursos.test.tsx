import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";

// Datos inventados.
const PROPUESTA = {
  origen: { id: "c1", nombre: "2026-27" },
  destino: "2027-28",
  destinoExiste: false,
  secciones: SECCIONES,
  filas: [
    { educandoId: "e1", nombre: "Leo", apellidos: "Prado Sanz", seccionActualId: "s1", edad: 8, propuesta: { seccionId: "s2", motivo: "SUBE" } },
    { educandoId: "e2", nombre: "Alba", apellidos: "Prado Sanz", seccionActualId: "s1", edad: 6, propuesta: { seccionId: "s1", motivo: "SIGUE" } },
    { educandoId: "e3", nombre: "Iker", apellidos: "Ruiz Mora", seccionActualId: "s2", edad: null, propuesta: { seccionId: "s2", motivo: "SIN_FECHA" } },
    { educandoId: "e4", nombre: "Vera", apellidos: "Ruiz Mora", seccionActualId: "s3", edad: 14, propuesta: { seccionId: null, motivo: "TERMINA" } },
  ],
};
const CURSOS = { cursos: [{ id: "c1", nombre: "2026-27", activo: true }, { id: "c0", nombre: "2025-26", activo: false }], sugerido: "2026-27" };
const BASE = {
  "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
  "GET /secciones": { cuerpo: { secciones: SECCIONES } },
  "GET /cursos": { cuerpo: CURSOS },
  "GET /cursos/paso": { cuerpo: PROPUESTA },
  "GET /educandos": { cuerpo: { curso: { id: "c2", nombre: "2027-28" }, educandos: [] } },
};

describe("curso (D-84)", () => {
  it("muestra el curso activo, los anteriores y lleva al paso de curso", async () => {
    simularApi(BASE);
    const app = renderizar("/ajustes/curso");

    expect(await screen.findByText("2026-27")).toBeInTheDocument();
    expect(screen.getByText("2025-26")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Pasar a 2027-28/ }));

    expect(app.ruta()).toBe("/ajustes/curso/paso");
  });
});

describe("paso de curso (D-79 a D-81)", () => {
  it("propone por edad, deja corregirlo y manda a cada niño a donde se ha elegido", async () => {
    let enviado: unknown;
    simularApi({
      ...BASE,
      "POST /cursos/paso": (cuerpo) => {
        enviado = cuerpo;
        return { status: 201, cuerpo: { curso: { id: "c2", nombre: "2027-28", activo: true }, siguen: 3, terminan: 1 } };
      },
    });
    const app = renderizar("/ajustes/curso/paso");

    await screen.findByRole("heading", { name: "Paso de 2026-27 a 2027-28" });
    const castores = screen.getByRole("region", { name: "Ahora en Castores" });
    expect(within(castores).getByText("Cumple 8 en 2027")).toBeInTheDocument();
    expect(within(castores).getByLabelText("Sección de Leo Prado Sanz en el curso que viene")).toHaveValue("s2");
    expect(screen.getByLabelText("Vera Ruiz Mora sigue en el curso que viene")).not.toBeChecked();
    expect(screen.getByText("Termina")).toBeInTheDocument();
    expect(screen.getByText("Sin fecha de nacimiento", { selector: "span" })).toBeInTheDocument();

    // Iker no tiene fecha: se le sube a mano. Alba no sigue.
    await userEvent.selectOptions(screen.getByLabelText("Sección de Iker Ruiz Mora en el curso que viene"), "s3");
    await userEvent.click(screen.getByLabelText("Alba Prado Sanz sigue en el curso que viene"));

    await userEvent.click(screen.getByRole("button", { name: /Pasar a 2027-28/ }));
    const dialogo = await screen.findByRole("alertdialog", { name: "¿Pasar a 2027-28?" });
    expect(dialogo).toHaveTextContent("Se matricularán 2 niños en 2027-28 y 2 no seguirán");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Pasar a 2027-28" }));

    await waitFor(() => expect(app.ruta()).toBe("/educandos"));
    expect(enviado).toEqual({
      origenId: "c1",
      filas: [
        { educandoId: "e1", seccionId: "s2" },
        { educandoId: "e2", seccionId: null },
        { educandoId: "e3", seccionId: "s3" },
        { educandoId: "e4", seccionId: null },
      ],
    });
  });

  it("filtra los que no siguen", async () => {
    simularApi(BASE);
    renderizar("/ajustes/curso/paso");

    await userEvent.click(await screen.findByRole("radio", { name: "No siguen" }));

    expect(screen.getByText("Vera")).toBeInTheDocument();
    expect(screen.queryByText("Leo")).not.toBeInTheDocument();
  });

  it("si el curso siguiente ya existe, lo explica y no deja confirmar", async () => {
    simularApi({ ...BASE, "GET /cursos/paso": { cuerpo: { ...PROPUESTA, destinoExiste: true } } });
    renderizar("/ajustes/curso/paso");

    expect(await screen.findByRole("alert")).toHaveTextContent("El curso 2027-28 ya existe");
    expect(screen.getByRole("button", { name: /Pasar a 2027-28/ })).toBeDisabled();
  });
});

describe("edad máxima de una sección (D-79)", () => {
  it("se edita y se puede dejar vacía", async () => {
    const enviados: unknown[] = [];
    simularApi({
      ...BASE,
      "PATCH /secciones/s3": (cuerpo) => {
        enviados.push(cuerpo);
        return { cuerpo: { seccion: SECCIONES[2] } };
      },
    });
    renderizar("/ajustes/secciones");

    expect(await screen.findByText("Hasta los 13 años")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Editar Tropa" }));
    const dialogo = await screen.findByRole("dialog", { name: "Editar Tropa" });
    const edad = within(dialogo).getByLabelText("Edad máxima (opcional)");
    await userEvent.clear(edad);
    await userEvent.type(edad, "14,5");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));
    expect(await within(dialogo).findByText("Escribe la edad en años, sin decimales")).toBeInTheDocument();

    await userEvent.clear(edad);
    await userEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(enviados).toEqual([{ nombre: "Tropa", color: "tropa", edadMaxima: null }]));
  });
});
