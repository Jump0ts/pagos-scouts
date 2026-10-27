import type request from "supertest";
import { nombreCursoPara } from "../src/modules/cursos/cursos.utils.js";
import { prisma } from "../src/prisma.js";
import { grupoConAdmin, invitarYAceptar, seccionesDe } from "./helpers.js";

type Seccion = { id: string; nombre: string };

const alta = (agente: request.Agent, datos: object) => agente.post("/api/educandos").send(datos);

const grupoConNinos = async () => {
  const { admin, grupo } = await grupoConAdmin();
  const secciones: Seccion[] = await seccionesDe(admin);
  const [castores, manada] = secciones;
  const mateo = await alta(admin, {
    nombre: "Mateo", apellidos: "Gil Ferrer", seccionId: castores.id,
    familia: { nueva: { responsables: ["Lucía Ferrer Soto", "Andrés Gil Rubio"] } },
  }).expect(201);
  const sara = await alta(admin, {
    nombre: "Sara", apellidos: "Gil Ferrer", fechaNacimiento: "2015-03-02", seccionId: manada.id,
    familia: { id: mateo.body.educando.familiaId },
  }).expect(201);
  return { admin, grupo, castores, manada, secciones, mateo: mateo.body.educando, sara: sara.body.educando };
};

describe("cursos", () => {
  it("el primer alta crea el curso actual y lo deja activo", async () => {
    const { admin } = await grupoConNinos();

    const res = await admin.get("/api/cursos").expect(200);

    expect(res.body.cursos).toEqual([expect.objectContaining({ nombre: nombreCursoPara(), activo: true })]);
  });

  it.each([
    ["2026-10-27", "2026-27"],
    ["2027-03-01", "2026-27"],
    ["2027-08-31", "2026-27"],
    ["2027-09-01", "2027-28"],
    ["2099-12-01", "2099-00"],
  ])("el %s es del curso %s", (fecha, curso) => {
    expect(nombreCursoPara(new Date(fecha))).toBe(curso);
  });
});

describe("educandos", () => {
  it("alta en una familia nueva o en una existente; la familia toma los apellidos del hijo", async () => {
    const { admin, mateo, sara } = await grupoConNinos();

    expect(sara.familiaId).toBe(mateo.familiaId);
    const ficha = (await admin.get(`/api/familias/${mateo.familiaId}`).expect(200)).body.familia;
    expect(ficha.nombre).toBe("Familia Gil Ferrer");
    expect(ficha.responsables.map((r: { nombreCompleto: string }) => r.nombreCompleto)).toEqual(["Lucía Ferrer Soto", "Andrés Gil Rubio"]);
    expect(ficha.educandos.map((e: { nombre: string }) => e.nombre)).toEqual(["Mateo", "Sara"]);
  });

  it("valida la fecha de nacimiento y la seccion", async () => {
    const { admin, castores, mateo } = await grupoConNinos();

    const fecha = await alta(admin, { nombre: "Leo", seccionId: castores.id, fechaNacimiento: "2999-01-01", familia: { id: mateo.familiaId } });
    const seccion = await alta(admin, { nombre: "Leo", seccionId: "no-existe", familia: { id: mateo.familiaId } });

    expect(fecha.status).toBe(400);
    expect(fecha.body.campos.fechaNacimiento).toBe("Fecha no válida");
    expect(seccion.status).toBe(400);
  });

  it("cambia de seccion en el curso activo", async () => {
    const { admin, mateo, manada } = await grupoConNinos();

    await admin.patch(`/api/educandos/${mateo.id}`).send({ seccionId: manada.id }).expect(200);

    const lista = (await admin.get("/api/educandos")).body.educandos;
    expect(lista.find((e: { id: string }) => e.id === mateo.id).seccionId).toBe(manada.id);
  });

  it("moverlo a una familia nueva borra la anterior si se queda vacia", async () => {
    const { admin, mateo, sara } = await grupoConNinos();

    await admin.patch(`/api/educandos/${mateo.id}`).send({ familia: { nueva: { responsables: [] } } }).expect(200);
    await admin.patch(`/api/educandos/${sara.id}`).send({ familia: { nueva: { responsables: [] } } }).expect(200);

    expect(await prisma.familia.count({ where: { id: mateo.familiaId } })).toBe(0);
    expect(await prisma.familia.count()).toBe(2);
  });

  it("la baja lo saca de la lista sin borrarlo, y se puede deshacer", async () => {
    const { admin, mateo } = await grupoConNinos();

    await admin.post(`/api/educandos/${mateo.id}/baja`).expect(204);
    expect((await admin.get("/api/educandos")).body.educandos).toHaveLength(1);
    expect(await prisma.educando.count()).toBe(2);
    const ficha = (await admin.get(`/api/familias/${mateo.familiaId}`)).body.familia;
    expect(ficha.educandos.find((e: { id: string }) => e.id === mateo.id).deBaja).toBe(true);

    await admin.delete(`/api/educandos/${mateo.id}/baja`).expect(204);
    expect((await admin.get("/api/educandos")).body.educandos).toHaveLength(2);
  });

  it("solo un administrador borra definitivamente; al borrar al ultimo hijo se borra la familia", async () => {
    const { admin, mateo, sara } = await grupoConNinos();
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");

    await tesoreria.agente.delete(`/api/educandos/${mateo.id}`).expect(403);
    await admin.delete(`/api/educandos/${mateo.id}`).expect(204);
    await admin.delete(`/api/educandos/${sara.id}`).expect(204);

    expect(await prisma.familia.count()).toBe(0);
  });

  it("edita los responsables de una familia", async () => {
    const { admin, mateo } = await grupoConNinos();

    const res = await admin.patch(`/api/familias/${mateo.familiaId}`).send({ responsables: ["Lucía Ferrer Soto"] }).expect(200);

    expect(res.body.familia.responsables).toHaveLength(1);
  });
});

describe("scouters (D-32)", () => {
  it("solo ven los niños de sus secciones, sin la familia, y no abren fichas ni dan altas", async () => {
    const { admin, castores, mateo } = await grupoConNinos();
    const scouter = await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [castores.id]);

    const lista = (await scouter.agente.get("/api/educandos").expect(200)).body.educandos;

    expect(lista).toEqual([{ id: mateo.id, nombre: "Mateo", apellidos: "Gil Ferrer", seccionId: castores.id }]);
    await scouter.agente.get(`/api/familias/${mateo.familiaId}`).expect(403);
    await alta(scouter.agente, { nombre: "X", seccionId: castores.id, familia: { nueva: {} } }).expect(403);
  });
});

describe("aislamiento entre grupos", () => {
  it("no se ve ni se toca a los niños ni a las familias de otro grupo", async () => {
    const { mateo } = await grupoConNinos();
    const rio = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");
    const [seccionRio] = await seccionesDe(rio.admin);

    expect((await rio.admin.get("/api/educandos")).body.educandos).toEqual([]);
    await rio.admin.get(`/api/familias/${mateo.familiaId}`).expect(404);
    await rio.admin.patch(`/api/educandos/${mateo.id}`).send({ nombre: "Hackeado" }).expect(404);
    await rio.admin.delete(`/api/educandos/${mateo.id}`).expect(404);
    await alta(rio.admin, { nombre: "Intruso", seccionId: seccionRio.id, familia: { id: mateo.familiaId } }).expect(404);
  });
});
