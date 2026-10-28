import { grupoConAdmin, invitarYAceptar, seccionesDe } from "./helpers.js";

// D-11: cada grupo solo ve y toca lo suyo, aunque alguien conozca los identificadores de otro grupo.
describe("aislamiento entre grupos", () => {
  it("cada grupo solo ve sus secciones y sus personas", async () => {
    const pinar = await grupoConAdmin("Grupo Scout Pinar", "admin@pinar.test");
    const rio = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");
    await invitarYAceptar(rio.admin, "t@rio.test", "TESORERIA");

    const seccionesPinar = await seccionesDe(pinar.admin);
    const seccionesRio = await seccionesDe(rio.admin);
    const usuariosPinar = (await pinar.admin.get("/api/usuarios").expect(200)).body;

    expect(seccionesPinar.map((s) => s.id)).not.toEqual(expect.arrayContaining([seccionesRio[0].id]));
    expect(usuariosPinar.miembros.map((m: { usuario: { email: string } }) => m.usuario.email)).toEqual(["admin@pinar.test"]);
  });

  it("no se pueden tocar secciones ni personas de otro grupo", async () => {
    const pinar = await grupoConAdmin("Grupo Scout Pinar", "admin@pinar.test");
    const rio = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");
    const seccionDelRio = (await seccionesDe(rio.admin))[0];
    const tesoreroDelRio = await invitarYAceptar(rio.admin, "t@rio.test", "TESORERIA");
    const invitacionDelRio = await rio.admin.post("/api/usuarios/invitaciones").send({ email: "x@rio.test", rol: "ADMIN" });

    await pinar.admin.patch(`/api/secciones/${seccionDelRio.id}`).send({ nombre: "Hackeada" }).expect(404);
    await pinar.admin.patch(`/api/usuarios/${tesoreroDelRio.membresiaId}`).send({ rol: "ADMIN" }).expect(404);
    await pinar.admin.delete(`/api/usuarios/${tesoreroDelRio.membresiaId}`).expect(404);
    await pinar.admin.post(`/api/usuarios/${tesoreroDelRio.membresiaId}/restablecer`).expect(404);
    await pinar.admin.delete(`/api/usuarios/invitaciones/${invitacionDelRio.body.invitacion.id}`).expect(404);

    expect((await seccionesDe(rio.admin))[0].nombre).toBe(seccionDelRio.nombre);
  });
});
