import request from "supertest";
import type { Agent } from "supertest";
import { emitirTicket } from "../src/modules/pedidos/publico.proteccion.js";
import { limpiarEnviosCaducados } from "../src/modules/pedidos/pedidos.utils.js";
import { prisma } from "../src/prisma.js";
import { app, grupoConAdmin, invitarYAceptar, seccionesDe } from "./helpers.js";

// Datos inventados. Familia Vidal Soler: Nora (Manada) y Bruno (Tropa). Iker Molina Ros (Manada).
type Seccion = { id: string; nombre: string };
type Catalogo = { id: string; nombre: string; opciones: { id: string; nombre: string; valores: { id: string; valor: string }[] }[] }[];

const alta = async (agente: Agent, nombre: string, apellidos: string, seccionId: string, familia: object) =>
  (await agente.post("/api/educandos").send({ nombre, apellidos, seccionId, fechaNacimiento: null, familia }).expect(201)).body.educando as {
    id: string;
    familiaId: string;
  };

const sudaderas = (extra: object = {}) => ({
  nombre: "Sudaderas 2026",
  fechaInicio: "2026-01-01",
  fechaFin: "2099-12-31",
  instruccionesPago: "Bizum al 600 000 000 indicando el nombre del niño",
  articulos: [
    {
      nombre: "Camiseta",
      precioCentimos: 1200,
      maxUnidades: 2,
      opciones: [
        { nombre: "Talla", tipo: "LISTA", valores: [{ valor: "9/10" }, { valor: "11/12" }, { valor: "XL", suplementoCentimos: 200 }] },
        { nombre: "Nombre al dorso", tipo: "TEXTO", obligatoria: false, maxLongitud: 12, suplementoCentimos: 300 },
      ],
    },
    { nombre: "Sudadera", precioCentimos: 2500, opciones: [{ nombre: "Talla", tipo: "LISTA", valores: [{ valor: "9/10" }, { valor: "11/12" }] }] },
  ],
  ...extra,
});

const escenario = async () => {
  const { admin } = await grupoConAdmin();
  const secciones: Seccion[] = await seccionesDe(admin);
  const [, manada, tropa] = secciones;
  const nora = await alta(admin, "Nora", "Vidal Soler", manada.id, { nueva: { responsables: ["Elena Soler Gil"] } });
  const bruno = await alta(admin, "Bruno", "Vidal Soler", tropa.id, { id: nora.familiaId });
  const iker = await alta(admin, "Iker", "Molina Ros", manada.id, { nueva: { responsables: ["Pablo Molina Ruiz"] } });
  const creado = await admin.post("/api/pedidos").send(sudaderas()).expect(201);
  const pedidoId: string = creado.body.pedido.id;
  const detalle = (await admin.get(`/api/pedidos/${pedidoId}`).expect(200)).body;
  const enlace: string = detalle.pedido.enlace;
  const codigo = enlace.split("#")[1];
  const catalogo: Catalogo = detalle.pedido.articulos;
  return { admin, secciones, manada, tropa, nora, bruno, iker, pedidoId, enlace, codigo, catalogo };
};

// Lo que mandaria la web: el codigo del enlace, un justificante con el tiempo minimo ya pasado y las lineas.
const camiseta = (catalogo: Catalogo, talla: string, dorso?: string) => {
  const art = catalogo.find((a) => a.nombre === "Camiseta")!;
  const [optTalla, optDorso] = art.opciones;
  return {
    articuloId: art.id,
    elecciones: [
      { opcionId: optTalla.id, valorId: optTalla.valores.find((v) => v.valor === talla)!.id },
      ...(dorso ? [{ opcionId: optDorso.id, texto: dorso }] : []),
    ],
  };
};

const envio = (e: Awaited<ReturnType<typeof escenario>>, extra: object = {}) => ({
  enlace: e.codigo,
  ticket: emitirTicket(e.pedidoId, Date.now() - 10_000),
  web: "",
  nombre: "Nora",
  apellidos: "Vidal Soler",
  seccionId: e.manada.id,
  lineas: [camiseta(e.catalogo, "XL", "Nora")],
  ...extra,
});

const publico = () => request(app);

describe("crear y ver un pedido", () => {
  it("Tesorería crea el pedido con su catálogo y su enlace, que lleva el código detrás del #", async () => {
    const { admin, pedidoId, enlace, catalogo } = await escenario();
    expect(enlace).toMatch(/^https:\/\/scouts\.example\.test\/pedido#[A-Za-z0-9_-]{43}$/);
    expect(catalogo.map((a) => a.nombre)).toEqual(["Camiseta", "Sudadera"]);
    const lista = (await admin.get("/api/eventos").expect(200)).body.eventos;
    expect(lista).toEqual([expect.objectContaining({ id: pedidoId, tipo: "PEDIDO", cerrado: false })]);
  });

  it("valida el catálogo: un texto sin longitud, una lista sin valores o un nombre con fórmula", async () => {
    const { admin } = await grupoConAdmin();
    const [castores] = await seccionesDe(admin);
    await alta(admin, "Ana", "Ros", castores.id, { nueva: { responsables: ["Eva Ros"] } });
    const mal = (articulos: object[]) => admin.post("/api/pedidos").send(sudaderas({ articulos })).expect(400);
    await mal([{ nombre: "Gorra", precioCentimos: 500, opciones: [{ nombre: "Texto", tipo: "TEXTO" }] }]);
    await mal([{ nombre: "Gorra", precioCentimos: 500, opciones: [{ nombre: "Color", tipo: "LISTA", valores: [] }] }]);
    await mal([{ nombre: "=HYPERLINK(1)", precioCentimos: 500 }]);
  });

  it("un scouter no crea pedidos y no ve el enlace ni los pendientes", async () => {
    const { admin, manada, pedidoId } = await escenario();
    const { agente: scouter } = await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [manada.id]);
    await scouter.post("/api/pedidos").send(sudaderas()).expect(403);
    const d = (await scouter.get(`/api/pedidos/${pedidoId}`).expect(200)).body.pedido;
    expect(d.enlace).toBeUndefined();
    expect(d.pendientes).toBeUndefined();
    await scouter.get(`/api/pedidos/${pedidoId}/envios`).expect(403);
  });

  it("las rutas de eventos normales no tocan un pedido", async () => {
    const { admin, pedidoId, nora } = await escenario();
    await admin.patch(`/api/eventos/${pedidoId}`).send({ nombre: "Otro" }).expect(400);
    await admin.post(`/api/eventos/${pedidoId}/ninos`).send({ educandoIds: [nora.id] }).expect(400);
  });
});

describe("formulario público", () => {
  it("con el código en la cabecera devuelve el catálogo, las secciones y un justificante, nunca el listado", async () => {
    const { codigo } = await escenario();
    const res = await publico().get("/api/publico/pedido").set("X-Enlace-Pedido", codigo).expect(200);
    expect(res.body).toEqual({
      grupo: "Grupo Scout Pinar",
      pedido: { nombre: "Sudaderas 2026", fechaFin: "2099-12-31", instruccionesPago: expect.any(String) },
      secciones: expect.any(Array),
      articulos: expect.any(Array),
      ticket: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/Vidal|Molina|Soler/);
  });

  it("el mismo 404 para un código falso, uno antiguo, un pedido cerrado o que aún no ha empezado", async () => {
    const e = await escenario();
    const mensaje = async (codigo: string) =>
      (await publico().get("/api/publico/pedido").set("X-Enlace-Pedido", codigo).expect(404)).body.error;
    const falso = await mensaje("a".repeat(43));
    expect(await mensaje("corto")).toBe(falso);

    const nuevo = (await e.admin.post(`/api/pedidos/${e.pedidoId}/enlace`).expect(200)).body.enlace as string;
    expect(await mensaje(e.codigo)).toBe(falso);
    const codigoNuevo = nuevo.split("#")[1];
    await publico().get("/api/publico/pedido").set("X-Enlace-Pedido", codigoNuevo).expect(200);

    await e.admin.post(`/api/pedidos/${e.pedidoId}/cerrar`).expect(204);
    expect(await mensaje(codigoNuevo)).toBe(falso);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/reabrir`).expect(204);
    await e.admin.patch(`/api/pedidos/${e.pedidoId}`).send({ fechaInicio: "2099-01-01" }).expect(200);
    expect(await mensaje(codigoNuevo)).toBe(falso);
  });

  it("un envío válido queda pendiente y devuelve el resumen con el total y las instrucciones", async () => {
    const e = await escenario();
    const res = await publico().post("/api/publico/pedido").send(envio(e, { lineas: [camiseta(e.catalogo, "XL", "Nora"), camiseta(e.catalogo, "9/10")] })).expect(201);
    expect(res.body.resumen.totalCentimos).toBe(1200 + 200 + 300 + 1200);
    expect(res.body.instruccionesPago).toMatch(/Bizum/);
    expect(await prisma.envioPedido.count()).toBe(1);
    // Nada de cargos hasta que Tesoreria lo acepte (D-68).
    expect(await prisma.cargo.count()).toBe(0);
  });

  it("demasiado rápido, caducado o con el justificante de otro pedido: no se guarda", async () => {
    const e = await escenario();
    await publico().post("/api/publico/pedido").send(envio(e, { ticket: emitirTicket(e.pedidoId) })).expect(400);
    await publico().post("/api/publico/pedido").send(envio(e, { ticket: emitirTicket(e.pedidoId, Date.now() - 13 * 3600_000) })).expect(400);
    await publico().post("/api/publico/pedido").send(envio(e, { ticket: emitirTicket("otro-pedido", Date.now() - 10_000) })).expect(400);
    await publico().post("/api/publico/pedido").send(envio(e, { ticket: "123.falsa" })).expect(400);
    expect(await prisma.envioPedido.count()).toBe(0);
  });

  it("el campo trampa relleno: responde como si nada pero no guarda", async () => {
    const e = await escenario();
    await publico().post("/api/publico/pedido").send(envio(e, { web: "http://spam.test" })).expect(201);
    expect(await prisma.envioPedido.count()).toBe(0);
  });

  it("rechaza campos inesperados, secciones de otro grupo, textos peligrosos y más unidades de las permitidas", async () => {
    const e = await escenario();
    const otro = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");
    const seccionAjena = (await seccionesDe(otro.admin))[0];
    const mal = (extra: object) => publico().post("/api/publico/pedido").send(envio(e, extra)).expect(400);
    await mal({ educandoId: "x" });
    await mal({ seccionId: seccionAjena.id });
    await mal({ nombre: "=cmd|' /C calc'!A0" });
    await mal({ apellidos: "<img src=x onerror=alert(1)>" });
    await mal({ lineas: [camiseta(e.catalogo, "9/10", "=1+1")] });
    await mal({ lineas: [camiseta(e.catalogo, "9/10"), camiseta(e.catalogo, "9/10"), camiseta(e.catalogo, "9/10")] });
    await mal({ lineas: [] });
    expect(await prisma.envioPedido.count()).toBe(0);
  });

  it("límite de envíos por IP", async () => {
    const e = await escenario();
    for (let i = 0; i < 10; i++) await publico().post("/api/publico/pedido").send(envio(e)).expect(201);
    await publico().post("/api/publico/pedido").send(envio(e)).expect(429);
  });

  it("tope de envíos pendientes por pedido", async () => {
    const e = await escenario();
    await prisma.envioPedido.createMany({
      data: Array.from({ length: 300 }, () => ({ eventoId: e.pedidoId, nombre: "X", apellidos: "Y", seccionId: e.manada.id, lineas: [], totalCentimos: 0 })),
    });
    await publico().post("/api/publico/pedido").send(envio(e)).expect(429);
  });
});

describe("revisar lo enviado", () => {
  const enviar = async (e: Awaited<ReturnType<typeof escenario>>, extra: object = {}) =>
    publico().post("/api/publico/pedido").send(envio(e, extra)).expect(201);
  const pendientes = async (e: Awaited<ReturnType<typeof escenario>>) => (await e.admin.get(`/api/pedidos/${e.pedidoId}/envios`).expect(200)).body.envios;

  it("semáforo, aceptar crea el cargo con lo que vio la familia y borra el envío", async () => {
    const e = await escenario();
    await enviar(e);
    const [p] = await pendientes(e);
    expect(p).toEqual(expect.objectContaining({ semaforo: "RECONOCIDO", totalCentimos: 1700, posibleCambio: false }));
    expect(p.candidatos).toEqual([expect.objectContaining({ educandoId: e.nora.id })]);

    // Aunque el catalogo suba de precio despues, se cobra lo que vio al enviar.
    const detalle = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body.pedido;
    const articulos = detalle.articulos.map((a: { precioCentimos: number }, i: number) => ({ ...a, precioCentimos: i === 0 ? 9900 : a.precioCentimos }));
    await e.admin.patch(`/api/pedidos/${e.pedidoId}`).send({ articulos }).expect(200);

    await e.admin.post(`/api/pedidos/${e.pedidoId}/envios/${p.id}/aceptar`).send({ educandoId: e.nora.id }).expect(204);
    expect(await prisma.envioPedido.count()).toBe(0);
    const d = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body;
    expect(d.personas).toEqual([
      expect.objectContaining({ educando: expect.objectContaining({ nombre: "Nora" }), importeCentimos: 1700, estado: "PENDIENTE" }),
    ]);
    expect(d.proveedor.textos).toEqual([{ articulo: "Camiseta", opciones: "Talla: XL", texto: "Nombre al dorso: Nora" }]);
    // El cargo es como cualquier otro: lo ve el resumen del evento y lo puede cuadrar el banco.
    expect((await e.admin.get(`/api/eventos/${e.pedidoId}`).expect(200)).body.resumen.debidoCentimos).toBe(1700);
  });

  it("un segundo envío de la misma persona sale como posible cambio; se puede sustituir lo anterior", async () => {
    const e = await escenario();
    await enviar(e);
    let [p] = await pendientes(e);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/envios/${p.id}/aceptar`).send({ educandoId: e.nora.id }).expect(204);

    await enviar(e, { lineas: [camiseta(e.catalogo, "9/10")] });
    [p] = await pendientes(e);
    expect(p.posibleCambio).toBe(true);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/envios/${p.id}/aceptar`).send({ educandoId: e.nora.id, reemplazar: true }).expect(204);
    const d = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body;
    expect(d.personas[0].importeCentimos).toBe(1200);
    expect(d.personas[0].lineas).toHaveLength(1);
  });

  it("rechazar borra el envío", async () => {
    const e = await escenario();
    await enviar(e);
    const [p] = await pendientes(e);
    await e.admin.delete(`/api/pedidos/${e.pedidoId}/envios/${p.id}`).expect(204);
    expect(await prisma.envioPedido.count()).toBe(0);
  });

  it("no se acepta para alguien de otro grupo ni con el pedido cerrado", async () => {
    const e = await escenario();
    const otro = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");
    const [, manadaRio] = await seccionesDe(otro.admin);
    const ajeno = await alta(otro.admin, "Leo", "Paz Gil", manadaRio.id, { nueva: { responsables: ["Rut Gil"] } });
    await enviar(e);
    const [p] = await pendientes(e);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/envios/${p.id}/aceptar`).send({ educandoId: ajeno.id }).expect(400);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/cerrar`).expect(204);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/envios/${p.id}/aceptar`).send({ educandoId: e.nora.id }).expect(409);
  });
});

describe("líneas a mano, pagos y cierre", () => {
  it("Tesorería apunta a mano, sin tope de unidades; quitar líneas recalcula y sin líneas sale del pedido", async () => {
    const e = await escenario();
    const tres = [camiseta(e.catalogo, "9/10"), camiseta(e.catalogo, "9/10"), camiseta(e.catalogo, "11/12")];
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.iker.id, lineas: tres }).expect(201);
    let d = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body;
    expect(d.personas[0].importeCentimos).toBe(3600);
    expect(d.proveedor.unidades).toEqual([
      { articulo: "Camiseta", opciones: "Talla: 9/10", unidades: 2 },
      { articulo: "Camiseta", opciones: "Talla: 11/12", unidades: 1 },
    ]);
    for (const l of d.personas[0].lineas) await e.admin.delete(`/api/pedidos/${e.pedidoId}/lineas/${l.id}`).expect(204);
    d = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body;
    expect(d.personas).toEqual([]);
  });

  it("no se quitan líneas por debajo de lo ya pagado", async () => {
    const e = await escenario();
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.iker.id, lineas: [camiseta(e.catalogo, "9/10"), camiseta(e.catalogo, "9/10")] }).expect(201);
    const cargo = await prisma.cargo.findFirstOrThrow({ where: { eventoId: e.pedidoId }, include: { educando: true } });
    const grupo = await prisma.grupo.findFirstOrThrow();
    await prisma.movimiento.create({
      data: {
        grupoId: grupo.id,
        origen: "MANUAL",
        concepto: "Pago en mano",
        importeCentimos: 2400,
        estado: "CLASIFICADO",
        familiaId: cargo.educando.familiaId,
        asignaciones: { create: { cargoId: cargo.id, importeCentimos: 2400 } },
      },
    });
    const d = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body;
    expect(d.personas[0].estado).toBe("PAGADO");
    await e.admin.delete(`/api/pedidos/${e.pedidoId}/lineas/${d.personas[0].lineas[0].id}`).expect(409);
  });

  it("cerrado no se cambian líneas; reabierto, sí", async () => {
    const e = await escenario();
    await e.admin.post(`/api/pedidos/${e.pedidoId}/cerrar`).expect(204);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.iker.id, lineas: [camiseta(e.catalogo, "9/10")] }).expect(409);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/reabrir`).expect(204);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.iker.id, lineas: [camiseta(e.catalogo, "9/10")] }).expect(201);
  });

  it("un artículo con unidades pedidas no se puede quitar del catálogo; renombrarlo no cambia lo pedido", async () => {
    const e = await escenario();
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.iker.id, lineas: [camiseta(e.catalogo, "9/10")] }).expect(201);
    const articulos = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body.pedido.articulos;
    await e.admin.patch(`/api/pedidos/${e.pedidoId}`).send({ articulos: [articulos[1]] }).expect(409);
    await e.admin.patch(`/api/pedidos/${e.pedidoId}`).send({ articulos: [{ ...articulos[0], nombre: "Camiseta azul" }, articulos[1]] }).expect(200);
    const d = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body;
    expect(d.pedido.articulos[0].nombre).toBe("Camiseta azul");
    expect(d.personas[0].lineas[0].articulo).toBe("Camiseta azul");
    expect(d.personas[0].lineas[0].elecciones).toEqual([{ opcion: "Talla", tipo: "LISTA", valor: "9/10", suplementoCentimos: 0 }]);
  });

  it("el pedido se mantiene aunque el niño se dé de baja (no sigue al listado)", async () => {
    const e = await escenario();
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.iker.id, lineas: [camiseta(e.catalogo, "9/10")] }).expect(201);
    await e.admin.post(`/api/educandos/${e.iker.id}/baja`).expect(204);
    const d = (await e.admin.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body;
    expect(d.personas).toHaveLength(1);
    expect(d.personas[0].importeCentimos).toBe(1200);
  });

  it("un scouter ve lo pedido en sus secciones y exporta solo eso", async () => {
    const e = await escenario();
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.nora.id, lineas: [camiseta(e.catalogo, "9/10")] }).expect(201);
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.bruno.id, lineas: [camiseta(e.catalogo, "11/12")] }).expect(201);
    const { agente: scouter } = await invitarYAceptar(e.admin, "s@pinar.test", "SCOUTER", [e.tropa.id]);
    expect((await scouter.get("/api/eventos").expect(200)).body.eventos).toHaveLength(1);
    const d = (await scouter.get(`/api/pedidos/${e.pedidoId}`).expect(200)).body;
    expect(d.personas.map((p: { educando: { nombre: string } }) => p.educando.nombre)).toEqual(["Bruno"]);
    await scouter.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.bruno.id, lineas: [camiseta(e.catalogo, "9/10")] }).expect(403);
  });
});

describe("exportar", () => {
  const leer = (res: request.Response) => res.body as Buffer;

  it("por persona y para el proveedor, como .xlsx", async () => {
    const e = await escenario();
    await e.admin.post(`/api/pedidos/${e.pedidoId}/lineas`).send({ educandoId: e.nora.id, lineas: [camiseta(e.catalogo, "XL", "Nora")] }).expect(201);
    const binario = (r: request.Request) => r.buffer(true).parse((res, cb) => {
      const partes: Buffer[] = [];
      res.on("data", (c: Buffer) => partes.push(c));
      res.on("end", () => cb(null, Buffer.concat(partes)));
    });
    const XLSX = await import("xlsx");
    const filas = (b: Buffer, hoja = 0) => {
      const libro = XLSX.read(b, { type: "buffer" });
      return XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[libro.SheetNames[hoja]], { header: 1 });
    };

    const personas = leer(await binario(e.admin.get(`/api/pedidos/${e.pedidoId}/exportar?vista=personas`)).expect(200));
    expect(filas(personas).at(-1)).toEqual(["Nora", "Vidal Soler", "Manada", "Camiseta · XL · Nombre al dorso «Nora»", 17, 0, 17, "Pendiente"]);

    const proveedor = leer(await binario(e.admin.get(`/api/pedidos/${e.pedidoId}/exportar?vista=proveedor`)).expect(200));
    // Todo en una hoja: articulo, opciones, unidades y nombre, sin decir de quien es.
    expect(filas(proveedor)).toEqual([["Sudaderas 2026"], ["1 unidad"], [], ["Artículo", "Opciones", "Unidades", "Nombre"], ["Camiseta", "Talla: XL", 1, "Nora"]]);
  });
});

describe("aislamiento y conservación", () => {
  it("otro grupo no ve ni toca un pedido ajeno", async () => {
    const e = await escenario();
    const otro = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");
    await otro.admin.get(`/api/pedidos/${e.pedidoId}`).expect(404);
    await otro.admin.post(`/api/pedidos/${e.pedidoId}/enlace`).expect(404);
    await otro.admin.get(`/api/pedidos/${e.pedidoId}/envios`).expect(404);
    await otro.admin.get(`/api/pedidos/${e.pedidoId}/exportar`).expect(404);
  });

  it("los envíos sin revisar se borran 30 días después de cerrar o terminar el pedido", async () => {
    const e = await escenario();
    await publico().post("/api/publico/pedido").send(envio(e)).expect(201);
    expect(await limpiarEnviosCaducados()).toBe(0);
    await prisma.evento.update({ where: { id: e.pedidoId }, data: { cerradoEn: new Date(Date.now() - 31 * 24 * 3600_000) } });
    expect(await limpiarEnviosCaducados()).toBe(1);
  });
});
