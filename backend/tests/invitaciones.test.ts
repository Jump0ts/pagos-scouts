import request from "supertest";
import { crearGrupo } from "../src/modules/grupos/grupos.utils.js";
import { prisma } from "../src/prisma.js";
import { app, CONTRASENA, grupoConAdmin, seccionesDe, tokenDe } from "./helpers.js";

describe("alta de un grupo (comando del servidor)", () => {
  it("crea las 6 secciones por defecto en orden y una invitacion de administrador", async () => {
    const { grupo, enlace } = await crearGrupo("Grupo Scout Pinar", "admin@pinar.test");

    const secciones = await prisma.seccion.findMany({ where: { grupoId: grupo.id }, orderBy: { orden: "asc" } });
    expect(secciones.map((s) => s.nombre)).toEqual(["Castores", "Manada", "Tropa", "Unidad", "Clan", "Scouters"]);
    expect(enlace).toMatch(/^https:\/\/scouts\.example\.test\/invitacion\/[\w-]{43}$/);
    expect(await prisma.invitacion.findFirst({ where: { grupoId: grupo.id } })).toMatchObject({ rol: "ADMIN" });
  });
});

describe("abrir y aceptar una invitacion", () => {
  it("muestra a quien invita y a que grupo, sin pedir sesion", async () => {
    const { enlace } = await crearGrupo("Grupo Scout Pinar", "admin@pinar.test");

    const res = await request(app).get(`/api/invitaciones/${tokenDe(enlace)}`).expect(200);

    expect(res.body).toEqual({
      grupo: { nombre: "Grupo Scout Pinar" },
      email: "admin@pinar.test",
      rol: "ADMIN",
      usuarioExiste: false,
    });
  });

  it("crea la cuenta, la mete en el grupo y abre sesion", async () => {
    const { grupo, enlace } = await crearGrupo("Grupo Scout Pinar", "admin@pinar.test");
    const agente = request.agent(app);

    const res = await agente
      .post(`/api/invitaciones/${tokenDe(enlace)}/aceptar`)
      .send({ nombre: "Admin Pinar", contrasena: CONTRASENA })
      .expect(201);

    expect(res.body.grupoActivo).toMatchObject({ id: grupo.id, rol: "ADMIN" });
    await agente.get("/api/auth/yo").expect(200);
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: "admin@pinar.test" } });
    expect(usuario.hashContrasena).toMatch(/^\$argon2id\$/);
  });

  it("solo se puede usar una vez", async () => {
    const { enlace } = await crearGrupo("Grupo Scout Pinar", "admin@pinar.test");
    const token = tokenDe(enlace);
    await request(app).post(`/api/invitaciones/${token}/aceptar`).send({ nombre: "Admin", contrasena: CONTRASENA }).expect(201);

    await request(app).get(`/api/invitaciones/${token}`).expect(404);
    await request(app).post(`/api/invitaciones/${token}/aceptar`).send({ nombre: "Otra", contrasena: CONTRASENA }).expect(404);
  });

  it("caduca a los 7 dias", async () => {
    const { enlace } = await crearGrupo("Grupo Scout Pinar", "admin@pinar.test");
    await prisma.invitacion.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } });

    const res = await request(app).get(`/api/invitaciones/${tokenDe(enlace)}`).expect(404);
    expect(res.body.error).toBe("Esta invitacion no existe o ha caducado");
  });

  it("exige una contrasena de al menos 10 caracteres y un nombre a quien no tiene cuenta", async () => {
    const { enlace } = await crearGrupo("Grupo Scout Pinar", "admin@pinar.test");
    const token = tokenDe(enlace);

    const corta = await request(app).post(`/api/invitaciones/${token}/aceptar`).send({ nombre: "Admin", contrasena: "corta" });
    const sinNombre = await request(app).post(`/api/invitaciones/${token}/aceptar`).send({ contrasena: CONTRASENA });

    expect(corta.status).toBe(400);
    expect(corta.body.campos.contrasena).toMatch(/10 caracteres/);
    expect(sinNombre.status).toBe(400);
    expect(sinNombre.body.campos.nombre).toBe("Escribe tu nombre");
  });

  it("une a otro grupo a quien ya tiene cuenta, comprobando su contrasena actual", async () => {
    await grupoConAdmin("Grupo Scout Pinar", "admin@pinar.test");
    const { grupo: rio, enlace } = await crearGrupo("Grupo Scout Rio", "admin@pinar.test");
    const token = tokenDe(enlace);

    expect((await request(app).get(`/api/invitaciones/${token}`)).body.usuarioExiste).toBe(true);
    await request(app).post(`/api/invitaciones/${token}/aceptar`).send({ contrasena: "no-es-la-suya" }).expect(401);
    const res = await request(app).post(`/api/invitaciones/${token}/aceptar`).send({ contrasena: CONTRASENA }).expect(201);

    expect(res.body.grupos.map((g: { nombre: string }) => g.nombre)).toEqual(["Grupo Scout Pinar", "Grupo Scout Rio"]);
    expect(res.body.grupoActivo.id).toBe(rio.id);
  });
});

describe("invitar desde la web", () => {
  it("un scouter necesita al menos una seccion, y de su grupo", async () => {
    const pinar = await grupoConAdmin("Grupo Scout Pinar", "admin@pinar.test");
    const rio = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");
    const seccionDelRio = (await seccionesDe(rio.admin))[0].id;

    const sinSecciones = await pinar.admin.post("/api/usuarios/invitaciones").send({ email: "s@pinar.test", rol: "SCOUTER" });
    const ajena = await pinar.admin
      .post("/api/usuarios/invitaciones")
      .send({ email: "s@pinar.test", rol: "SCOUTER", seccionIds: [seccionDelRio] });

    expect(sinSecciones.status).toBe(400);
    expect(sinSecciones.body.campos.seccionIds).toBe("Un scouter necesita al menos una seccion");
    expect(ajena.status).toBe(400);
  });

  it("una invitacion nueva para el mismo email sustituye a la anterior", async () => {
    const { admin } = await grupoConAdmin();
    const primera = await admin.post("/api/usuarios/invitaciones").send({ email: "t@pinar.test", rol: "TESORERIA" }).expect(201);
    await admin.post("/api/usuarios/invitaciones").send({ email: "t@pinar.test", rol: "ADMIN" }).expect(201);

    await request(app).get(`/api/invitaciones/${tokenDe(primera.body.enlace)}`).expect(404);
    const lista = await admin.get("/api/usuarios").expect(200);
    expect(lista.body.invitaciones).toHaveLength(1);
    expect(lista.body.invitaciones[0]).toMatchObject({ email: "t@pinar.test", rol: "ADMIN" });
  });

  it("no invita a quien ya esta en el grupo", async () => {
    const { admin } = await grupoConAdmin();

    const res = await admin.post("/api/usuarios/invitaciones").send({ email: "admin@pinar.test", rol: "TESORERIA" });

    expect(res.status).toBe(409);
  });

  it("se puede retirar una invitacion pendiente", async () => {
    const { admin } = await grupoConAdmin();
    const creada = await admin.post("/api/usuarios/invitaciones").send({ email: "t@pinar.test", rol: "TESORERIA" }).expect(201);

    await admin.delete(`/api/usuarios/invitaciones/${creada.body.invitacion.id}`).expect(204);

    await request(app).get(`/api/invitaciones/${tokenDe(creada.body.enlace)}`).expect(404);
  });
});
