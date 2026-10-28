import request from "supertest";
import * as XLSX from "xlsx";
import { prisma } from "../src/prisma.js";
import { BANCO, escenario, estados, evento, lista, subir, type Movimiento, type Seccion } from "./escenario-pagos.js";
import { app, grupoConAdmin, invitarYAceptar, seccionesDe } from "./helpers.js";

describe("importar movimientos del banco (D-41)", () => {
  it("analizar dice lo que pasaría sin guardar nada", async () => {
    const { admin } = await escenario();
    const res = await subir(admin, "analizar").expect(200);

    expect(res.body).toMatchObject({ nuevos: 4, yaImportados: 0, salidasIgnoradas: 1, clasificados: 2, dudas: 2, desde: "2026-10-01", hasta: "2026-10-04" });
    // Por orden de fecha, con la familia y los cargos que paga o se le sugieren.
    expect(res.body.movimientos.map((m: Movimiento) => [m.concepto, m.estado, m.motivo, m.familia?.nombre ?? null])).toEqual([
      ["FERRER SOTO LUCIA", "CLASIFICADO", null, "Familia Gil Ferrer"],
      ["CARMEN VIDAL ORTEGA", "CLASIFICADO", null, "Familia Navas Vidal"],
      ["LUCIA FERRER SOTO", "DUDA", "VARIAS_COMBINACIONES", "Familia Gil Ferrer"],
      ["ASOCIACION VECINAL", "DUDA", "PAGADOR_DESCONOCIDO", null],
    ]);
    expect(res.body.movimientos[0].cargos).toEqual([
      expect.objectContaining({ evento: "Cuota", educando: "Sara", importeCentimos: 11000 }),
      expect.objectContaining({ evento: "Cuota", educando: "Mateo", importeCentimos: 8500 }),
    ]);
    expect(res.body.movimientos[2].cargos).toEqual([expect.objectContaining({ evento: "Censo", importeCentimos: 3000 })]);
    expect(await prisma.movimiento.count()).toBe(0);
  });

  it("confirmar guarda, marca lo pagado en los eventos y no duplica al volver a subirlo (D-45)", async () => {
    const { admin, cuota, censo } = await escenario();
    await subir(admin, "confirmar").expect(201);

    const clasificados = await lista(admin, "CLASIFICADO");
    expect(clasificados.contadores).toEqual({ dudas: 2, clasificados: 2, otros: 0 });
    expect(clasificados.movimientos.map((m) => [m.concepto, m.clasificadoPor])).toEqual([
      ["CARMEN VIDAL ORTEGA", null],
      ["FERRER SOTO LUCIA", null],
    ]);
    expect(await estados(admin, cuota)).toEqual({ Irene: "PAGADO", Mateo: "PAGADO", Sara: "PAGADO" });
    expect(await estados(admin, censo)).toEqual({ Irene: "PAGADO", Mateo: "PENDIENTE", Sara: "PENDIENTE" });
    const resumen = (await admin.get(`/api/eventos/${cuota}`).expect(200)).body.resumen;
    expect(resumen).toEqual({ debidoCentimos: 30500, pagadoCentimos: 30500, ninos: 3, alDia: 3 });

    const otraVez = await subir(admin, "confirmar", [...BANCO, [6, "2026-10-06", "CARMEN VIDAL ORTEGA", 10]]).expect(201);
    expect(otraVez.body).toMatchObject({ nuevos: 1, yaImportados: 4 });
    expect(await prisma.movimiento.count()).toBe(5);
  });

  it("la ficha de familia muestra lo que debe y lo que ha pagado cada niño", async () => {
    const { admin, sara } = await escenario();
    await subir(admin, "confirmar").expect(201);
    const ficha = (await admin.get(`/api/familias/${sara.familiaId}`).expect(200)).body.familia;
    const deSara = ficha.educandos.find((e: { nombre: string }) => e.nombre === "Sara");
    expect(deSara.cargos.map((c: { evento: { nombre: string }; estado: string }) => [c.evento.nombre, c.estado])).toEqual([
      ["Cuota", "PAGADO"],
      ["Censo", "PENDIENTE"],
    ]);
    expect(ficha.pagos).toEqual([expect.objectContaining({ origen: "BANCO", fecha: "2026-10-01", importeCentimos: 19500 })]);
  });

  it("rechaza ficheros que no son del banco", async () => {
    const { admin } = await escenario();
    await admin.post("/api/movimientos/importar/analizar").set("Content-Type", "application/octet-stream").send(Buffer.from("hola")).expect(400);
    await admin.post("/api/movimientos/importar/analizar").set("Content-Type", "application/octet-stream").send(Buffer.alloc(0)).expect(400);
  });
});

describe("deshacer (D-5)", () => {
  it("un clasificado vuelve a Dudas con sus cargos sugeridos y la deuda vuelve a estar pendiente", async () => {
    const { admin, cuota } = await escenario();
    await subir(admin, "confirmar").expect(201);
    const gil = (await lista(admin, "CLASIFICADO")).movimientos.find((m) => m.concepto === "FERRER SOTO LUCIA")!;

    await admin.post(`/api/movimientos/${gil.id}/deshacer`).expect(204);

    expect(await estados(admin, cuota)).toMatchObject({ Mateo: "PENDIENTE", Sara: "PENDIENTE" });
    const deshecho = (await lista(admin, "DUDA")).movimientos.find((m) => m.id === gil.id)!;
    expect(deshecho).toMatchObject({ motivo: "DESHECHO", familia: { nombre: "Familia Gil Ferrer" } });
    expect(deshecho.cargos.map((c) => c.educando)).toEqual(["Sara", "Mateo"]);
    await admin.post(`/api/movimientos/${gil.id}/deshacer`).expect(409);
  });
});

describe("un cargo con pagos queda protegido (D-30, D-36)", () => {
  it("no se recalcula, no se anula con la baja y no se puede borrar ni quitar", async () => {
    const { admin, manada, tropa, sara, mateo, cuota } = await escenario();
    await subir(admin, "confirmar").expect(201);
    const cargoSara = (await admin.get(`/api/eventos/${cuota}`).expect(200)).body.cargos.find((c: { educando: { nombre: string } }) => c.educando.nombre === "Sara");

    // Subir el precio no toca lo ya pagado.
    const editado = await admin.patch(`/api/eventos/${cuota}`).send({ precios: [manada, tropa].map((s) => ({ seccionId: s.id, importeCentimos: 12000 })) }).expect(200);
    expect(editado.body).toMatchObject({ recalculados: 0, sinCambiar: 3 });

    await admin.post(`/api/educandos/${sara.id}/baja`).expect(204);
    expect(await estados(admin, cuota)).toMatchObject({ Sara: "PAGADO", Mateo: "PAGADO" });

    await admin.patch(`/api/eventos/${cuota}/cargos/${cargoSara.id}`).send({ importeAjustadoCentimos: 5000 }).expect(400);
    await admin.delete(`/api/eventos/${cuota}/cargos/${cargoSara.id}`).expect(409);
    await admin.delete(`/api/eventos/${cuota}`).expect(409);
    await admin.delete(`/api/educandos/${mateo.id}`).expect(409);
    await admin.delete(`/api/familias/${sara.familiaId}`).expect(409);
  });
});

describe("permisos y grupos", () => {
  it("un scouter no ve los movimientos del banco (D-16)", async () => {
    const { admin, tropa } = await escenario();
    const { agente } = await invitarYAceptar(admin, "scouter@pinar.test", "SCOUTER", [tropa.id]);
    await agente.get("/api/movimientos").expect(403);
    await subir(agente, "analizar").expect(403);
  });

  it("otro grupo no ve ni deshace los movimientos", async () => {
    const { admin } = await escenario();
    await subir(admin, "confirmar").expect(201);
    const uno = (await lista(admin, "CLASIFICADO")).movimientos[0];

    const { admin: otro } = await grupoConAdmin("Grupo Scout Ribera", "admin@ribera.test");
    expect((await lista(otro, "CLASIFICADO")).contadores).toEqual({ dudas: 0, clasificados: 0, otros: 0 });
    await otro.post(`/api/movimientos/${uno.id}/deshacer`).expect(404);
    // Y su Excel se clasifica contra sus propias familias: aquí nadie conoce a esta madre.
    const analisis = await subir(otro, "analizar").expect(200);
    expect(analisis.body).toMatchObject({ nuevos: 4, clasificados: 0 });
  });

  it("sin sesión, nada", async () => {
    await request(app).get("/api/movimientos").expect(401);
  });
});

describe("marcas «Pagado» del listado (D-44)", () => {
  const LISTADO = [
    ["Nombres padres", "Educando", "Pago cuota"],
    ["Lucía Ferrer Soto / Andrés Gil Rubio", "Sara Gil Ferrer", "Pagado"],
    ["Lucía Ferrer Soto / Andrés Gil Rubio", "Mateo Gil Ferrer", ""],
  ];
  const excel = () => {
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(LISTADO), "Hoja 1");
    return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
  };

  type Propuesta = { familias: { avisos: string[]; ninos: object[] }[]; columnasPago: { clave: string; titulo: string }[] };
  const importar = async (agente: request.Agent, seccionId: string, eventoId: string | null) => {
    const propuesta = (await agente.post("/api/importaciones/listado/analizar").set("Content-Type", "application/octet-stream").send(excel()).expect(200))
      .body as Propuesta;
    return agente
      .post("/api/importaciones/listado/confirmar")
      .send({
        curso: "2026-27",
        secciones: { 0: seccionId },
        familias: propuesta.familias.map(({ avisos: _, ...f }) => f),
        columnasPago: eventoId ? propuesta.columnasPago.map((c) => ({ clave: c.clave, titulo: c.titulo, eventoId })) : [],
      })
      .expect(201);
  };

  it("crean un pago por lo pendiente, no se duplican y avisan al llegar el mismo pago del banco", async () => {
    const { admin } = await grupoConAdmin();
    const [, , tropa] = (await seccionesDe(admin)) as Seccion[];
    await importar(admin, tropa.id, null);
    const cuota = (await admin.post("/api/eventos").send(evento("Cuota", [tropa], 11000)).expect(201)).body.evento.id;

    const res = await importar(admin, tropa.id, cuota);
    expect(res.body).toMatchObject({ marcasImportadas: 1, marcasSinCargo: 0, marcasYaPagadas: 0 });
    expect(await estados(admin, cuota)).toEqual({ Mateo: "PENDIENTE", Sara: "PAGADO" });
    const marca = (await lista(admin, "CLASIFICADO")).movimientos[0];
    expect(marca).toMatchObject({ concepto: "Marcado como pagado en el listado (Pago cuota)", clasificadoPor: "Admin Pinar" });

    expect((await importar(admin, tropa.id, cuota)).body).toMatchObject({ marcasImportadas: 0, marcasYaPagadas: 1 });

    // La familia paga las dos cuotas por el banco, pero la de Sara ya estaba marcada: solo quedan 110 € pendientes.
    const analisis = await subir(admin, "analizar", [[1, "2026-10-01", "LUCIA FERRER SOTO", 220]]).expect(200);
    expect(analisis.body.movimientos[0]).toMatchObject({ estado: "DUDA", motivo: "POSIBLE_YA_MARCADO" });

    // Deshacer una marca la borra: no es dinero que haya entrado por el banco.
    await admin.post(`/api/movimientos/${marca.id}/deshacer`).expect(204);
    expect(await prisma.movimiento.count()).toBe(0);
  });

  it("no acepta eventos de otro grupo", async () => {
    const { admin: otro } = await grupoConAdmin("Grupo Scout Ribera", "admin@ribera.test");
    const [, , tropaOtro] = (await seccionesDe(otro)) as Seccion[];
    await importar(otro, tropaOtro.id, null);
    const ajeno = (await otro.post("/api/eventos").send(evento("Cuota", [tropaOtro], 11000)).expect(201)).body.evento.id;

    const { admin } = await grupoConAdmin();
    const [, , tropa] = (await seccionesDe(admin)) as Seccion[];
    const propuesta = (await admin.post("/api/importaciones/listado/analizar").set("Content-Type", "application/octet-stream").send(excel()).expect(200))
      .body as Propuesta;
    await admin
      .post("/api/importaciones/listado/confirmar")
      .send({
        curso: "2026-27",
        secciones: { 0: tropa.id },
        familias: propuesta.familias.map(({ avisos: _, ...f }) => f),
        columnasPago: propuesta.columnasPago.map((c) => ({ ...c, eventoId: ajeno })),
      })
      .expect(400);
    expect(await prisma.educando.count({ where: { grupo: { nombre: "Grupo Scout Pinar" } } })).toBe(0);
  });
});
