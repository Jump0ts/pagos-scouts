import { parseEnv } from "../src/env.js";

const URL_BD = "postgresql://u:p@localhost:5432/db";

describe("parseEnv", () => {
  it("aplica valores por defecto a lo opcional", () => {
    const env = parseEnv({ DATABASE_URL: URL_BD });

    expect(env).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      DATABASE_URL: URL_BD,
      PUBLIC_URL: "http://localhost:5173",
    });
  });

  it("falla con un mensaje claro si falta la base de datos", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rechaza un entorno desconocido", () => {
    expect(() => parseEnv({ DATABASE_URL: URL_BD, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  it("exige PUBLIC_URL en produccion, para que los enlaces apunten al dominio real", () => {
    expect(() => parseEnv({ DATABASE_URL: URL_BD, NODE_ENV: "production" })).toThrow(/PUBLIC_URL/);
  });

  it("quita la barra final de PUBLIC_URL", () => {
    expect(parseEnv({ DATABASE_URL: URL_BD, PUBLIC_URL: "https://scouts.example.test/" }).PUBLIC_URL).toBe(
      "https://scouts.example.test",
    );
  });
});
