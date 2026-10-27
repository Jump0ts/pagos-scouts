// Fuentes servidas desde el propio dominio: con Google Fonts el navegador de cada familia avisaría a Google.
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./styles/tema.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { queryClient } from "./queryClient";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
