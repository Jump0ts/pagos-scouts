import type request from "supertest";
import { prisma } from "../src/prisma.js";
import { grupoConAdmin, invitarYAceptar, seccionesDe } from "./helpers.js";

// Datos inventados. Familia Gil Ferrer: Sara (Tropa, la mayor), Mateo (Manada) y Leo (Castores).
type Seccion = { id: string; nombre: string };
type CargoVista = { id: string; educando: { nombre: string }; importeCentimos: number; posicionHermano: number; estado: string; motivoAjuste?: string | null };

const alta = async (agente: request.Agent, nombre: string, seccionId: string, familia: object, fechaNacimiento: string | null = null) =>
  (await agente.post("/api/educandos").send({ nombre, apellidos: "Gil Ferrer", seccionId, fechaNacimiento, familia }).expect(201)).body.educando as {
    id: string;
    familiaId: string;
  };

const escenario = async () => {
  const { admin } = await grupoConAdmin();
  const secciones: Seccion[] = await seccionesDe(admin);
  const [castores, manada, tropa, unidad] = secciones;
  const sara = await alta(admin, "Sara", tropa.id, { nueva: { responsables: ["Lucía Ferrer Soto"] } }, "2013-02-10");
  const mateo = await alta(admin, "Mateo", manada.id, { id: sara.familiaId }, "2016-09-20");
  const leo = await alta(admin, "Leo", castores.id, { id: sara.familiaId }, "2019-05-01");
  return { admin, castores, manada, tropa, unidad, sara, mateo, leo };
};

const cuota = (secciones: Seccion[], extra: object = {}) => ({
  nombre: "Cuota 2026-27",
  tipo: "TODA_SECCION",
  fechaInicio: "2026-09-01",
  fechaFin: "2099-12-31",
  precios: secciones.map((s) => ({ seccionId: s.id, importeCentimos: 11000 })),
  descuentoHermanos: true,
  precioSegundoCentimos: 8500,
  precioTerceroCentimos: 6000,
  ...extra,
});

const detalle = async (agente: request.Agent, id: string) => (await agente.get(`/api/eventos/${id}`).expect(200)).body;
const cargosPorNombre = async (agente: request.Agent, id: string) =>
  Object.fromEntries(((await detalle(agente, id)).cargos as CargoVista[]).map((c) => [c.educando.nombre, c.importeCentimos]));

describe("crear eventos", () => {
  it("toda la sección: cargo para cada niño con el precio de hermanos (110 / 85 / 60)", async () => {
    const { admin, castores, manada, tropa } = await escenario();

    const creado = await admin.post("/api/eventos").send(cuota([castores, manada, tropa])).expect(201);

    const d = await detalle(admin, creado.body.evento.id);
    expect(await cargosPorNombre(admin, creado.body.evento.id)).toEqual({ Leo: 6000, Mateo: 8500, Sara: 11000 });
    expect(d.resumen).toEqual({ debidoCentimos: 25500, pagadoCentimos: 0, ninos: 3, alDia: 0 });
    expect(d.cargos.every((c: CargoVista) => c.estado === "PENDIENTE")).toBe(true);
  });

  it("solo las secciones elegidas: el resto no recibe cargo", async () => {
    const { admin, tropa } = await escenario();
    const creado = await admin.post("/api/eventos").send(cuota([tropa], { descuentoHermanos: false })).expect(201);
    expect(await cargosPorNombre(admin, creado.body.evento.id)).toEqual({ Sara: 11000 });
  });

  it("con apuntados: solo los marcados, y solo de secciones del evento", async () => {
    const { admin, castores, manada, mateo, leo, sara } = await escenario();
    const acampada = { ...cuota([castores, manada], { descuentoHermanos: false }), nombre: "Acampada", tipo: "CON_APUNTADOS" };

    await admin.post("/api/eventos").send({ ...acampada, apuntados: [sara.id] }).expect(400);
    const creado = await admin.post("/api/eventos").send({ ...acampada, apuntados: [leo.id] }).expect(201);

    expect(await cargosPorNombre(admin, creado.body.evento.id)).toEqual({ Leo: 11000 });
    await admin.post(`/api/eventos/${creado.body.evento.id}/ninos`).send({ educandoIds: [mateo.id] }).expect(204);
    expect(await cargosPorNombre(admin, creado.body.evento.id)).toEqual({ Leo: 11000, Mateo: 11000 });
  });

  it("valida fechas y el precio del 2º hermano", async () => {
    const { admin, tropa } = await escenario();

    const fechas = await admin.post("/api/eventos").send(cuota([tropa], { fechaFin: "2026-08-01" }));
    const segundo = await admin.post("/api/eventos").send(cuota([tropa], { precioSegundoCentimos: null }));

    expect(fechas.body.campos.fechaFin).toBe("La fecha de fin no puede ser anterior al inicio");
    expect(segundo.body.campos.precioSegundoCentimos).toBe("Indica el precio del 2º hermano");
  });
});

describe("las deudas se ajustan solas (D-36)", () => {
  it("un niño nuevo en una sección del evento abierto recibe su cargo como hermano", async () => {
    const { admin, castores, manada, tropa, sara } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores, manada, tropa]))).body.evento.id;

    await alta(admin, "Bruno", castores.id, { id: sara.familiaId }, "2020-01-01");

    expect(await cargosPorNombre(admin, id)).toMatchObject({ Bruno: 6000 });
  });

  it("en un evento ya cerrado, los niños actuales tienen cargo pero los nuevos no", async () => {
    const { admin, castores } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores], { fechaInicio: "2025-09-01", fechaFin: "2025-10-01" }))).body.evento.id;

    await alta(admin, "Bruno", castores.id, { nueva: { responsables: [] } });

    expect(Object.keys(await cargosPorNombre(admin, id))).toEqual(["Leo"]);
  });

  it("si se da de baja el mayor sin haber pagado, el siguiente pasa a pagar el completo", async () => {
    const { admin, castores, manada, tropa, sara } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores, manada, tropa]))).body.evento.id;

    await admin.post(`/api/educandos/${sara.id}/baja`).expect(204);
    expect(await cargosPorNombre(admin, id)).toEqual({ Mateo: 11000, Leo: 8500 });

    await admin.delete(`/api/educandos/${sara.id}/baja`).expect(204);
    expect(await cargosPorNombre(admin, id)).toEqual({ Sara: 11000, Mateo: 8500, Leo: 6000 });
  });

  it("al cambiar de sección a una sin precio, su cargo se anula", async () => {
    const { admin, tropa, unidad, sara } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([tropa]))).body.evento.id;

    await admin.patch(`/api/educandos/${sara.id}`).send({ seccionId: unidad.id }).expect(200);

    expect(await cargosPorNombre(admin, id)).toEqual({});
  });

  it("borrar a un niño recalcula a sus hermanos", async () => {
    const { admin, castores, manada, tropa, sara } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores, manada, tropa]))).body.evento.id;

    await admin.delete(`/api/educandos/${sara.id}`).expect(204);

    expect(await cargosPorNombre(admin, id)).toEqual({ Mateo: 11000, Leo: 8500 });
  });
});

describe("cambios en el evento y ajustes (D-35, D-37)", () => {
  it("cambiar el precio recalcula los pendientes y respeta los ajustados", async () => {
    const { admin, castores, manada, tropa } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores, manada, tropa]))).body.evento.id;
    const leo = ((await detalle(admin, id)).cargos as CargoVista[]).find((c) => c.educando.nombre === "Leo")!;
    await admin.patch(`/api/eventos/${id}/cargos/${leo.id}`).send({ importeAjustadoCentimos: 0, motivo: "Exento" }).expect(204);

    const res = await admin
      .patch(`/api/eventos/${id}`)
      .send({ precios: [castores, manada, tropa].map((s) => ({ seccionId: s.id, importeCentimos: 12000 })) })
      .expect(200);

    expect(res.body).toMatchObject({ recalculados: 1, sinCambiar: 1 });
    expect(await cargosPorNombre(admin, id)).toEqual({ Sara: 12000, Mateo: 8500, Leo: 0 });
    const d = await detalle(admin, id);
    expect(d.cargos.find((c: CargoVista) => c.educando.nombre === "Leo")).toMatchObject({ estado: "EXENTO", motivoAjuste: "Exento" });
  });

  it("quitar el precio de hermanos devuelve a todos al de su sección", async () => {
    const { admin, castores, manada, tropa } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores, manada, tropa]))).body.evento.id;

    await admin.patch(`/api/eventos/${id}`).send({ descuentoHermanos: false }).expect(200);

    expect(await cargosPorNombre(admin, id)).toEqual({ Sara: 11000, Mateo: 11000, Leo: 11000 });
  });

  it("quitar a un niño del evento lo deja fuera aunque se sincronice, y recalcula a sus hermanos", async () => {
    const { admin, castores, manada, tropa, sara } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores, manada, tropa]))).body.evento.id;
    const cargoSara = ((await detalle(admin, id)).cargos as CargoVista[]).find((c) => c.educando.nombre === "Sara")!;

    await admin.delete(`/api/eventos/${id}/cargos/${cargoSara.id}`).expect(204);
    await alta(admin, "Bruno", castores.id, { nueva: { responsables: [] } }); // fuerza otra sincronizacion

    expect(await cargosPorNombre(admin, id)).toMatchObject({ Mateo: 11000, Leo: 8500 });
    expect((await detalle(admin, id)).excluidos).toBe(1);
    await admin.post(`/api/eventos/${id}/ninos`).send({ educandoIds: [sara.id] }).expect(204);
    expect(await cargosPorNombre(admin, id)).toMatchObject({ Sara: 11000, Mateo: 8500, Leo: 6000 });
  });

  it("la importación de un listado también genera los cargos", async () => {
    const { admin, castores } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores], { descuentoHermanos: false }))).body.evento.id;

    await admin
      .post("/api/importaciones/listado/confirmar")
      .send({
        curso: (await prisma.curso.findFirstOrThrow()).nombre,
        secciones: { 0: castores.id },
        familias: [{ existenteId: null, nombre: "Familia Ruiz Calvo", responsables: [], ninos: [{ existenteId: null, nombre: "Hugo", apellidos: "Ruiz Calvo", bloque: 0 }] }],
      })
      .expect(201);

    expect(await cargosPorNombre(admin, id)).toEqual({ Leo: 11000, Hugo: 11000 });
  });
});

describe("permisos", () => {
  it("el scouter ve los eventos de sus secciones con importes pero sin motivos, y no los gestiona", async () => {
    const { admin, castores, manada, tropa } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([castores, manada, tropa]))).body.evento.id;
    await admin.post("/api/eventos").send({ ...cuota([tropa]), nombre: "Solo Tropa" }).expect(201);
    const leo = ((await detalle(admin, id)).cargos as CargoVista[]).find((c) => c.educando.nombre === "Leo")!;
    await admin.patch(`/api/eventos/${id}/cargos/${leo.id}`).send({ importeAjustadoCentimos: 3000, motivo: "Ayuda" }).expect(204);
    const scouter = await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [castores.id]);

    const lista = (await scouter.agente.get("/api/eventos").expect(200)).body.eventos;
    const d = await detalle(scouter.agente, id);

    expect(lista.map((e: { nombre: string }) => e.nombre)).toEqual(["Cuota 2026-27"]);
    expect(lista[0].resumen.debidoCentimos).toBe(3000);
    expect(d.cargos).toEqual([expect.objectContaining({ importeCentimos: 3000, ajustado: true })]);
    expect(d.cargos[0]).not.toHaveProperty("motivoAjuste");
    await scouter.agente.post("/api/eventos").send(cuota([castores])).expect(403);
  });

  it("tesorería crea y edita; solo un admin borra", async () => {
    const { admin, tropa } = await escenario();
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");

    const id = (await tesoreria.agente.post("/api/eventos").send(cuota([tropa])).expect(201)).body.evento.id;
    await tesoreria.agente.patch(`/api/eventos/${id}`).send({ nombre: "Cuota" }).expect(200);
    await tesoreria.agente.delete(`/api/eventos/${id}`).expect(403);
    await admin.delete(`/api/eventos/${id}`).expect(204);
    expect(await prisma.cargo.count()).toBe(0);
  });

  it("otro grupo no ve ni toca los eventos", async () => {
    const { admin, tropa } = await escenario();
    const id = (await admin.post("/api/eventos").send(cuota([tropa]))).body.evento.id;
    const rio = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");

    await rio.admin.get(`/api/eventos/${id}`).expect(404);
    await rio.admin.patch(`/api/eventos/${id}`).send({ nombre: "Otro nombre" }).expect(404);
    await rio.admin.delete(`/api/eventos/${id}`).expect(404);
    expect((await rio.admin.get("/api/eventos")).body.eventos).toEqual([]);
  });
});
