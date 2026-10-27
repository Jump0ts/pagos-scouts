import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();
const hayBaseDeDatos = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hayBaseDeDatos)("GET /api/health", () => {
  it("responde ok cuando la base de datos contesta", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", env: "test", db: "ok" });
  });
});

describe("rutas desconocidas", () => {
  it("devuelven 404 en JSON dentro de /api", async () => {
    const res = await request(app).get("/api/no-existe");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Ruta no encontrada" });
  });

  it("no anuncian Express en las cabeceras", async () => {
    const res = await request(app).get("/api/no-existe");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
