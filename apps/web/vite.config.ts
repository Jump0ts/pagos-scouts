/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // D-72 a D-74: instalable y con la web guardada para abrir al instante. Solo se guarda la web: las respuestas de
    // /api nunca (en un movil compartido o perdido no queda ningun dato de los niños). Una version nueva se activa
    // cuando la persona pulsa "Actualizar" (registerType: "prompt").
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Tesorería Scout",
        short_name: "Tesorería",
        description: "Quién ha pagado qué en tu grupo scout.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f5f8f5",
        theme_color: "#2f7a55",
        icons: [
          { src: "/icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icono-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        // Ni la API ni nada que no sea la web pasa por la cache.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // En desarrollo la API corre aparte (npm run backend:dev); en el servidor la pasa el nginx de la web.
  // changeOrigin: false conserva el Host de la web, como hacen los nginx en el servidor; si no, la proteccion
  // CSRF de la API (Origin == Host) rechazaria todo lo que cambia datos.
  server: { proxy: { "/api": { target: "http://localhost:4000", changeOrigin: false } } },
  // D-77: para probar la PWA instalada en un movil hace falta HTTPS; un tunel puntual de Cloudflare
  // (*.trycloudflare.com) apunta a la web compilada de "vite preview". Solo afecta a la vista previa local.
  preview: { allowedHosts: [".trycloudflare.com"] },
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
