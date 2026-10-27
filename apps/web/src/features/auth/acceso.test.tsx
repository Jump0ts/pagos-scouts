import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERFIL_ADMIN, renderizar, simularApi } from "@/test/renderizar";

const SIN_SESION = { "GET /auth/yo": { status: 401, cuerpo: { error: "Inicia sesión para continuar" } } };

describe("login", () => {
  it("sin sesión, cualquier pantalla lleva al login", async () => {
    simularApi(SIN_SESION);
    const app = renderizar("/ajustes/personas");

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(app.ruta()).toBe("/login");
  });

  it("valida antes de enviar", async () => {
    const api = simularApi(SIN_SESION);
    renderizar("/login");

    await userEvent.click(await screen.findByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Escribe tu email")).toBeInTheDocument();
    expect(screen.getByText("Escribe tu contraseña")).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1); // solo /auth/yo
  });

  it("muestra el error de la API y no entra", async () => {
    simularApi({ ...SIN_SESION, "POST /auth/login": { status: 401, cuerpo: { error: "Email o contraseña incorrectos" } } });
    renderizar("/login");

    await userEvent.type(await screen.findByLabelText("Email"), "ana@pinar.test");
    await userEvent.type(screen.getByLabelText("Contraseña"), "otra-cosa");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos");
  });

  it("al entrar vuelve a la pantalla que se quería ver", async () => {
    simularApi({ ...SIN_SESION, "POST /auth/login": { cuerpo: PERFIL_ADMIN }, "GET /secciones": { cuerpo: { secciones: [] } } });
    const app = renderizar("/ajustes/secciones");

    await userEvent.type(await screen.findByLabelText("Email"), "ana@pinar.test");
    await userEvent.type(screen.getByLabelText("Contraseña"), "una-contrasena-larga");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => expect(app.ruta()).toBe("/ajustes/secciones"));
  });
});

describe("invitación", () => {
  it("a quien no tiene cuenta le pide nombre y contraseña repetida", async () => {
    simularApi({
      "GET /invitaciones/abc": { cuerpo: { grupo: { nombre: "Grupo Scout Pinar" }, email: "luis@pinar.test", rol: "TESORERIA", usuarioExiste: false } },
    });
    renderizar("/invitacion/abc");

    expect(await screen.findByRole("heading", { name: "Únete a Grupo Scout Pinar" })).toBeInTheDocument();
    expect(screen.getByText("Tesorería", { selector: "strong" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Tu nombre"), "Luis");
    await userEvent.type(screen.getByLabelText("Elige una contraseña"), "una-contrasena-larga");
    await userEvent.type(screen.getByLabelText("Repite la contraseña"), "otra-contrasena-larga");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta y entrar" }));

    expect(await screen.findByText("Las contraseñas no coinciden")).toBeInTheDocument();
  });

  it("a quien ya tiene cuenta solo le pide su contraseña", async () => {
    simularApi({
      "GET /invitaciones/abc": { cuerpo: { grupo: { nombre: "Grupo Scout Río" }, email: "ana@pinar.test", rol: "SCOUTER", usuarioExiste: true } },
    });
    renderizar("/invitacion/abc");

    expect(await screen.findByRole("button", { name: "Unirme al grupo" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Tu nombre")).not.toBeInTheDocument();
  });

  it("explica qué hacer si el enlace ya no vale", async () => {
    simularApi({ "GET /invitaciones/viejo": { status: 404, cuerpo: { error: "Esta invitación no existe o ha caducado" } } });
    renderizar("/invitacion/viejo");

    expect(await screen.findByText("Esta invitación no existe o ha caducado")).toBeInTheDocument();
    expect(screen.getByText(/genere un enlace nuevo/)).toBeInTheDocument();
  });
});

describe("permisos en la web", () => {
  it("un scouter no ve las pestañas de administración y no puede entrar en ellas", async () => {
    simularApi({
      "GET /auth/yo": { cuerpo: { ...PERFIL_ADMIN, grupoActivo: { ...PERFIL_ADMIN.grupoActivo, rol: "SCOUTER" } } },
      "GET /health": { cuerpo: { status: "ok", env: "test", db: "ok" } },
    });
    const app = renderizar("/ajustes/personas");

    await waitFor(() => expect(app.ruta()).toBe("/"));
    act(() => app.navegar("/ajustes"));
    expect(await screen.findByRole("link", { name: "Mi cuenta" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Personas" })).not.toBeInTheDocument();
  });
});
