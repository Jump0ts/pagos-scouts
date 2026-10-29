// Fuentes servidas desde el propio dominio: con Google Fonts el navegador de cada familia avisaría a Google.
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./styles/tema.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AvisosApp } from "./features/pwa/AvisosApp";
import { escucharInstalacion } from "./features/pwa/pwa.utils";
import { queryClient } from "./queryClient";
import { router } from "./router";

// D-74: el navegador ofrece instalarla muy pronto; se recoge antes de pintar nada.
escucharInstalacion();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AvisosApp />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
