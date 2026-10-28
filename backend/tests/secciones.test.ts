import { grupoConAdmin, invitarYAceptar, seccionesDe } from "./helpers.js";

describe("secciones", () => {
  it("cualquier miembro las ve, pero solo un administrador las cambia", async () => {
    const { admin } = await grupoConAdmin();
    const [tropa] = (await seccionesDe(admin)).filter((s) => s.nombre === "Tropa");
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");
    const scouter = await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [tropa.id]);

    expect(await seccionesDe(scouter.agente)).toHaveLength(6);
    await tesoreria.agente.post("/api/secciones").send({ nombre: "Pioneros", color: "unidad" }).expect(403);
    await scouter.agente.patch(`/api/secciones/${tropa.id}`).send({ nombre: "Rangers" }).expect(403);
  });

  it("un administrador crea una seccion nueva al final", async () => {
    const { admin } = await grupoConAdmin();

    const res = await admin.post("/api/secciones").send({ nombre: "Pioneros", color: "unidad" }).expect(201);

    expect(res.body.seccion).toMatchObject({ nombre: "Pioneros", color: "unidad", orden: 6, archivada: false });
  });

  it("no admite dos secciones con el mismo nombre ni colores inventados", async () => {
    const { admin } = await grupoConAdmin();

    const repetida = await admin.post("/api/secciones").send({ nombre: "Tropa", color: "tropa" });
    const color = await admin.post("/api/secciones").send({ nombre: "Pioneros", color: "fucsia" });

    expect(repetida.status).toBe(409);
    expect(color.status).toBe(400);
    expect(color.body.campos.color).toBe("Elige un color de la lista");
  });

  it("renombra y archiva", async () => {
    const { admin } = await grupoConAdmin();
    const [manada] = (await seccionesDe(admin)).filter((s) => s.nombre === "Manada");

    const res = await admin.patch(`/api/secciones/${manada.id}`).send({ nombre: "Lobatos", archivada: true }).expect(200);

    expect(res.body.seccion).toMatchObject({ nombre: "Lobatos", archivada: true });
  });

  it("reordena con la lista completa de secciones, y solo con ella", async () => {
    const { admin } = await grupoConAdmin();
    const secciones = await seccionesDe(admin);
    const alReves = secciones.map((s) => s.id).reverse();

    const res = await admin.put("/api/secciones/orden").send({ ids: alReves }).expect(200);
    await admin.put("/api/secciones/orden").send({ ids: alReves.slice(1) }).expect(400);

    expect(res.body.secciones.map((s: { nombre: string }) => s.nombre)).toEqual([
      "Scouters", "Clan", "Unidad", "Tropa", "Manada", "Castores",
    ]);
  });
});
