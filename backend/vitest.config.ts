import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Los tests usan TEST_DATABASE_URL (del entorno o de backend/.env) y nunca la base de desarrollo:
// tests/setup.ts se niega a arrancar si la base de datos no parece de pruebas.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? loadEnv("test", process.cwd(), "").TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    env: {
      ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}),
      PUBLIC_URL: "https://scouts.example.test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/cli/**", "src/types/**"],
    },
  },
});
