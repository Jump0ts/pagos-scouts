/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // En desarrollo la API corre aparte (npm run backend:dev); en el servidor la pasa el nginx de la web.
  // changeOrigin: false conserva el Host de la web, como hacen los nginx en el servidor; si no, la proteccion
  // CSRF de la API (Origin == Host) rechazaria todo lo que cambia datos.
  server: { proxy: { "/api": { target: "http://localhost:4000", changeOrigin: false } } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/test/**", "src/**/*.test.*"],
    },
  },
});
