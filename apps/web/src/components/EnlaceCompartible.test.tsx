import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnlaceCompartible } from "./EnlaceCompartible";

describe("EnlaceCompartible", () => {
  it("copia el enlace y lo confirma", async () => {
    const usuario = userEvent.setup();
    const escribir = vi.spyOn(navigator.clipboard, "writeText");
    render(<EnlaceCompartible enlace="https://scouts.example.test/invitacion/xyz" mensaje="Hola" caducidad="Caduca en 7 días" />);

    await usuario.click(screen.getByRole("button", { name: "Copiar enlace" }));

    expect(escribir).toHaveBeenCalledWith("https://scouts.example.test/invitacion/xyz");
    expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });

  it("ofrece Compartir solo si el navegador sabe hacerlo", async () => {
    const compartir = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: compartir, canShare: () => true });
    render(<EnlaceCompartible enlace="https://scouts.example.test/x" mensaje="Te invito:" caducidad="" />);

    await userEvent.click(screen.getByRole("button", { name: "Compartir" }));

    expect(compartir).toHaveBeenCalledWith({ text: "Te invito: https://scouts.example.test/x" });
  });
});
