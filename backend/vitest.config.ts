import { defineConfig } from "vitest/config";

// Los tests que necesitan base de datos usan TEST_DATABASE_URL (en la CI, el Postgres del propio job) y nunca
// la base de desarrollo. Sin ella se saltan, y una URL que no lleva a ningun sitio deja arrancar al resto.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "postgresql://sin-base-de-datos@127.0.0.1:1/ninguna";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    env: { DATABASE_URL: testDatabaseUrl },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
});
