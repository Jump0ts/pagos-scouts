import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EstadoSistema } from "./EstadoSistema";

const respuesta = (status: number, cuerpo: unknown) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } }));

describe("EstadoSistema", () => {
  it("muestra que todo funciona cuando la API y la base de datos responden", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respuesta(200, { status: "ok", env: "production", db: "ok" })));
    render(<EstadoSistema />);

    expect(await screen.findByText("Todo funciona.")).toBeInTheDocument();
    expect(screen.getByText("Responde (entorno production)")).toBeInTheDocument();
    expect(screen.getByText("Conectada")).toBeInTheDocument();
  });

  it("distingue una base de datos caída de una API caída", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respuesta(503, { status: "degradado", env: "production", db: "caida" })));
    render(<EstadoSistema />);

    expect(await screen.findByText("La API no puede conectar")).toBeInTheDocument();
    expect(screen.getByText("Hay algo que revisar.")).toBeInTheDocument();
  });

  it("avisa si la API no responde y permite volver a comprobar", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(() => respuesta(200, { status: "ok", env: "production", db: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<EstadoSistema />);

    expect(await screen.findByText("No responde")).toBeInTheDocument();
    // Sin API no se sabe nada de la base de datos, pero ya no se está comprobando.
    expect(screen.getByLabelText("Sin datos")).toBeInTheDocument();
    expect(screen.queryByLabelText("Comprobando")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Volver a comprobar" }));
    expect(await screen.findByText("Todo funciona.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
