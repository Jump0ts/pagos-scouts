// Fuentes servidas desde el propio dominio: con Google Fonts el navegador de cada familia avisaría a Google.
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "./styles/tema.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
