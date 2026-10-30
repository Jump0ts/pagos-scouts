import { act, render, screen } from "@testing-library/react";
import { AvisosApp } from "./AvisosApp";
import { GuiaInstalar } from "./GuiaInstalar";
import { plataforma } from "./pwa.utils";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36";

describe("instalar la app (D-74)", () => {
  it("reconoce iPhone, Android y escritorio", () => {
    expect(plataforma(IPHONE)).toBe("ios");
    expect(plataforma(ANDROID)).toBe("android");
    expect(plataforma("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0")).toBe("escritorio");
  });

  it("en iPhone explica Compartir → Añadir a pantalla de inicio", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    render(<GuiaInstalar />);
    expect(screen.getByText("Safari")).toBeInTheDocument();
    expect(screen.getByText("Añadir a pantalla de inicio")).toBeInTheDocument();
  });

  it("si el navegador lo ofrece, un botón instala directamente", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ANDROID);
    const { escucharInstalacion } = await import("./pwa.utils");
    escucharInstalacion();
    render(<GuiaInstalar />);
    expect(screen.queryByRole("button", { name: /Instalar la app/ })).not.toBeInTheDocument();
    const evento = Object.assign(new Event("beforeinstallprompt"), {
      prompt: vi.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    act(() => {
      window.dispatchEvent(evento);
    });
    expect(screen.getByRole("button", { name: /Instalar la app/ })).toBeInTheDocument();
  });
});

describe("sin conexión (D-72)", () => {
  it("avisa en cuanto se pierde la conexión", () => {
    const enLinea = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<AvisosApp />);
    expect(screen.queryByText(/Sin conexión/)).not.toBeInTheDocument();
    enLinea.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Sin conexión");
  });
});
