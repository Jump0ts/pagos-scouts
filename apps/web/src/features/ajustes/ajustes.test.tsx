import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "@/test/renderizar";

const BASE = { "GET /auth/yo": { cuerpo: PERFIL_ADMIN }, "GET /secciones": { cuerpo: { secciones: SECCIONES } } };

describe("personas", () => {
  it("invita a un scouter con sus secciones y muestra el enlace para enviar", async () => {
    let enviado: unknown;
    simularApi({
      ...BASE,
      "GET /usuarios": { cuerpo: { miembros: [], invitaciones: [] } },
      "POST /usuarios/invitaciones": (cuerpo) => {
        enviado = cuerpo;
        return {
          status: 201,
          cuerpo: {
            invitacion: { id: "i1", email: "marta@pinar.test", rol: "SCOUTER", expiraEn: "2026-11-03T10:00:00Z", seccionIds: ["s3"] },
            enlace: "https://scouts.example.test/invitacion/xyz",
          },
        };
      },
    });
    renderizar("/ajustes/personas");

    await userEvent.click(await screen.findByRole("button", { name: "Invitar" }));
    const dialogo = await screen.findByRole("dialog", { name: "Invitar a alguien" });
    await userEvent.type(within(dialogo).getByLabelText("Email"), "marta@pinar.test");
    await userEvent.click(within(dialogo).getByRole("radio", { name: /Scouter/ }));
    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear invitación" }));
    expect(await within(dialogo).findByText("Elige al menos una sección")).toBeInTheDocument();

    await userEvent.click(within(dialogo).getByRole("button", { name: "Tropa" }));
    await userEvent.click(within(dialogo).getByRole("button", { name: "Crear invitación" }));

    expect(await screen.findByDisplayValue("https://scouts.example.test/invitacion/xyz")).toBeInTheDocument();
    expect(enviado).toEqual({ email: "marta@pinar.test", rol: "SCOUTER", seccionIds: ["s3"] });
  });

  it("muestra a cada persona con su rol y marca tu cuenta", async () => {
    simularApi({
      ...BASE,
      "GET /usuarios": {
        cuerpo: {
          miembros: [
            { membresiaId: "m1", usuario: PERFIL_ADMIN.usuario, rol: "ADMIN", seccionIds: [], esTuCuenta: true },
            { membresiaId: "m2", usuario: { id: "u2", nombre: "Luis Mora", email: "luis@pinar.test" }, rol: "SCOUTER", seccionIds: ["s2"], esTuCuenta: false },
          ],
          invitaciones: [],
        },
      },
    });
    renderizar("/ajustes/personas");

    const luis = (await screen.findByText("Luis Mora")).closest("li")!;
    expect(within(luis).getByText("Scouter")).toBeInTheDocument();
    expect(within(luis).getByText("Manada")).toBeInTheDocument();
    expect(screen.getByText("Tú")).toBeInTheDocument();
  });
});

describe("secciones", () => {
  it("subir una sección envía el orden nuevo completo", async () => {
    let orden: unknown;
    simularApi({
      ...BASE,
      "PUT /secciones/orden": (cuerpo) => {
        orden = cuerpo;
        return { cuerpo: { secciones: SECCIONES } };
      },
    });
    renderizar("/ajustes/secciones");

    await userEvent.click(await screen.findByRole("button", { name: "Subir Tropa" }));

    await waitFor(() => expect(orden).toEqual({ ids: ["s1", "s3", "s2"] }));
    expect(screen.getByRole("button", { name: "Subir Castores" })).toBeDisabled();
  });
});
