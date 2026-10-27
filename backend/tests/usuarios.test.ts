import request from "supertest";
import { app, CONTRASENA, grupoConAdmin, invitarYAceptar, seccionesDe, tokenDe } from "./helpers.js";

describe("permisos de la gestion de usuarios", () => {
  it("solo los administradores pueden entrar", async () => {
    const { admin } = await grupoConAdmin();
    const [tropa] = (await seccionesDe(admin)).filter((s) => s.nombre === "Tropa");
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");
    const scouter = await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [tropa.id]);

    await tesoreria.agente.get("/api/usuarios").expect(403);
    await scouter.agente.get("/api/usuarios").expect(403);
    await request(app).get("/api/usuarios").expect(401);
    await admin.get("/api/usuarios").expect(200);
  });
});

describe("miembros del grupo", () => {
  it("lista a cada persona con su rol, sus secciones y cual es tu cuenta", async () => {
    const { admin } = await grupoConAdmin();
    const [tropa] = (await seccionesDe(admin)).filter((s) => s.nombre === "Tropa");
    await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [tropa.id]);

    const res = await admin.get("/api/usuarios").expect(200);

    expect(res.body.miembros).toEqual([
      expect.objectContaining({ rol: "ADMIN", seccionIds: [], esTuCuenta: true }),
      expect.objectContaining({ rol: "SCOUTER", seccionIds: [tropa.id], esTuCuenta: false }),
    ]);
  });

  it("cambia el rol y las secciones de alguien", async () => {
    const { admin } = await grupoConAdmin();
    const secciones = await seccionesDe(admin);
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");

    const res = await admin
      .patch(`/api/usuarios/${tesoreria.membresiaId}`)
      .send({ rol: "SCOUTER", seccionIds: [secciones[0].id, secciones[1].id] })
      .expect(200);

    expect(res.body).toEqual({ membresiaId: tesoreria.membresiaId, rol: "SCOUTER", seccionIds: [secciones[0].id, secciones[1].id] });
    const perfil = await tesoreria.agente.get("/api/auth/yo").expect(200);
    expect(perfil.body.grupoActivo.rol).toBe("SCOUTER");
  });

  it("el grupo nunca se queda sin administrador", async () => {
    const { admin } = await grupoConAdmin();
    const yo = (await admin.get("/api/usuarios")).body.miembros[0].membresiaId;

    const degradar = await admin.patch(`/api/usuarios/${yo}`).send({ rol: "TESORERIA" });
    const quitar = await admin.delete(`/api/usuarios/${yo}`);

    expect(degradar.status).toBe(409);
    expect(degradar.body.error).toBe("El grupo necesita al menos un administrador");
    expect(quitar.status).toBe(409);
  });

  it("quitar a alguien del grupo le corta el acceso al momento, aunque tenga la sesion abierta", async () => {
    const { admin } = await grupoConAdmin();
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");
    await tesoreria.agente.get("/api/secciones").expect(200);

    await admin.delete(`/api/usuarios/${tesoreria.membresiaId}`).expect(204);

    await tesoreria.agente.get("/api/secciones").expect(403);
  });
});

describe("restablecer contrasena", () => {
  it("el enlace cambia la contrasena, cierra sus sesiones y solo vale una vez", async () => {
    const { admin } = await grupoConAdmin();
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");

    const creado = await admin.post(`/api/usuarios/${tesoreria.membresiaId}/restablecer`).expect(201);
    const token = tokenDe(creado.body.enlace);
    expect((await request(app).get(`/api/restablecer/${token}`).expect(200)).body).toEqual({ email: "t@pinar.test" });

    await request(app).post(`/api/restablecer/${token}`).send({ contrasena: "la-nueva-contrasena" }).expect(204);

    await tesoreria.agente.get("/api/auth/yo").expect(401);
    await request(app).post("/api/auth/login").send({ email: "t@pinar.test", contrasena: CONTRASENA }).expect(401);
    await request(app).post("/api/auth/login").send({ email: "t@pinar.test", contrasena: "la-nueva-contrasena" }).expect(200);
    await request(app).post(`/api/restablecer/${token}`).send({ contrasena: "otra-contrasena-mas" }).expect(404);
  });

  it("un enlace nuevo anula el anterior", async () => {
    const { admin } = await grupoConAdmin();
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");
    const primero = await admin.post(`/api/usuarios/${tesoreria.membresiaId}/restablecer`).expect(201);
    await admin.post(`/api/usuarios/${tesoreria.membresiaId}/restablecer`).expect(201);

    await request(app).get(`/api/restablecer/${tokenDe(primero.body.enlace)}`).expect(404);
  });
});
