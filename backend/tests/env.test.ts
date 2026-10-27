import { parseEnv } from "../src/env.js";

describe("parseEnv", () => {
  it("aplica valores por defecto a lo opcional", () => {
    const env = parseEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/db" });

    expect(env).toEqual({ NODE_ENV: "development", PORT: 4000, DATABASE_URL: "postgresql://u:p@localhost:5432/db" });
  });

  it("falla con un mensaje claro si falta la base de datos", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rechaza un entorno desconocido", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgresql://u:p@localhost/db", NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });
});
