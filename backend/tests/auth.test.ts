import request from "supertest";
import { MAX_FALLOS } from "../src/modules/auth/intentos.js";
import { prisma } from "../src/prisma.js";
import { app, CONTRASENA, grupoConAdmin } from "./helpers.js";

const login = (email: string, contrasena: string) =>
  request(app).post("/api/auth/login").send({ email, contrasena });

describe("login", () => {
  it("abre sesion con una cookie httpOnly y devuelve el perfil con el grupo activo", async () => {
    const { grupo } = await grupoConAdmin();

    const res = await login("ADMIN@pinar.test ", CONTRASENA).expect(200);

    const cookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toMatch(/^sesion=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.body.usuario.email).toBe("admin@pinar.test");
    expect(res.body.grupoActivo).toMatchObject({ id: grupo.id, rol: "ADMIN" });
  });

  it("guarda el hash del token, nunca el token de la cookie", async () => {
    await grupoConAdmin();
    const res = await login("admin@pinar.test", CONTRASENA).expect(200);
    const token = /^sesion=([^;]+)/.exec(res.headers["set-cookie"]![0])![1];

    expect(await prisma.sesion.count({ where: { hashToken: token } })).toBe(0);
  });

  it("da el mismo error tanto si el email no existe como si la contrasena es incorrecta", async () => {
    await grupoConAdmin();

    const malaContrasena = await login("admin@pinar.test", "otra-contrasena").expect(401);
    const sinCuenta = await login("nadie@pinar.test", CONTRASENA).expect(401);

    expect(malaContrasena.body).toEqual(sinCuenta.body);
  });

  it(`bloquea el email tras ${MAX_FALLOS} intentos fallidos, aunque luego acierte`, async () => {
    await grupoConAdmin();
    for (let i = 0; i < MAX_FALLOS; i++) await login("admin@pinar.test", "otra-contrasena").expect(401);

    const res = await login("admin@pinar.test", CONTRASENA).expect(429);
    expect(res.body.error).toMatch(/Prueba de nuevo dentro de 15 min/);
  });

  it("valida los campos con mensajes claros", async () => {
    const res = await login("no-es-un-email", "").expect(400);

    expect(res.body.campos).toEqual({ email: "No es un email válido", contrasena: "Escribe tu contraseña" });
  });
});

describe("sesion", () => {
  it("/yo pide iniciar sesion si no hay cookie", async () => {
    await request(app).get("/api/auth/yo").expect(401);
  });

  it("cerrar sesion invalida la cookie en el servidor", async () => {
    const { admin } = await grupoConAdmin();
    await admin.get("/api/auth/yo").expect(200);

    await admin.post("/api/auth/logout").expect(204);

    await admin.get("/api/auth/yo").expect(401);
  });

  it("una sesion caducada no vale y se borra", async () => {
    const { admin } = await grupoConAdmin();
    await prisma.sesion.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } });

    await admin.get("/api/auth/yo").expect(401);
    expect(await prisma.sesion.count()).toBe(0);
  });
});

describe("cambiar la contrasena", () => {
  it("exige la actual, cambia la contrasena y cierra las demas sesiones, no esta", async () => {
    const { admin } = await grupoConAdmin();
    const otroDispositivo = request.agent(app);
    await otroDispositivo.post("/api/auth/login").send({ email: "admin@pinar.test", contrasena: CONTRASENA }).expect(200);

    const mal = await admin.put("/api/auth/contrasena").send({ actual: "no-es-esta", nueva: "la-nueva-contrasena" });
    expect(mal.status).toBe(400);
    expect(mal.body.campos.actual).toBe("La contraseña actual no es correcta");

    await admin.put("/api/auth/contrasena").send({ actual: CONTRASENA, nueva: "la-nueva-contrasena" }).expect(204);

    await admin.get("/api/auth/yo").expect(200);
    await otroDispositivo.get("/api/auth/yo").expect(401);
    await login("admin@pinar.test", "la-nueva-contrasena").expect(200);
  });
});

describe("grupo activo", () => {
  it("permite cambiar a otro grupo al que pertenece y no a uno ajeno", async () => {
    const pinar = await grupoConAdmin("Grupo Scout Pinar", "admin@pinar.test");
    const rio = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");

    await pinar.admin.put("/api/auth/grupo-activo").send({ grupoId: rio.grupo.id }).expect(403);
    const res = await pinar.admin.put("/api/auth/grupo-activo").send({ grupoId: pinar.grupo.id }).expect(200);
    expect(res.body.grupoActivo.id).toBe(pinar.grupo.id);
  });
});

describe("proteccion CSRF", () => {
  it("rechaza peticiones que cambian datos desde otro dominio", async () => {
    const { admin } = await grupoConAdmin();

    const res = await admin
      .post("/api/secciones")
      .set("Origin", "https://sitio-malicioso.example")
      .send({ nombre: "Pioneros", color: "unidad" });

    expect(res.status).toBe(403);
  });

  it("acepta las que vienen del mismo dominio", async () => {
    const { admin } = await grupoConAdmin();

    await admin
      .post("/api/secciones")
      .set("Host", "scouts.example.test")
      .set("Origin", "https://scouts.example.test")
      .send({ nombre: "Pioneros", color: "unidad" })
      .expect(201);
  });
});
