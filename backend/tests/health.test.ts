import request from "supertest";
import { app } from "./helpers.js";

describe("GET /api/health", () => {
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

  it("responden 400 legible ante un JSON mal formado", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{roto");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON/);
  });
});
