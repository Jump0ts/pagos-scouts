import { cursoSiguiente, edadEnCurso, proponerSeccion, type SeccionPaso } from "../src/modules/cursos/cursos.paso.js";
import { nombreCursoPara } from "../src/modules/cursos/cursos.utils.js";
import { prisma } from "../src/prisma.js";
import { alta, escenario, lista, subir } from "./escenario-pagos.js";
import { grupoConAdmin, invitarYAceptar, seccionesDe } from "./helpers.js";

// Datos inventados. Secciones como las de un grupo nuevo (D-3, D-79).
const SECCIONES: SeccionPaso[] = [
  { id: "castores", orden: 0, edadMaxima: 7, archivada: false },
  { id: "manada", orden: 1, edadMaxima: 10, archivada: false },
  { id: "tropa", orden: 2, edadMaxima: 13, archivada: false },
  { id: "unidad", orden: 3, edadMaxima: 16, archivada: false },
  { id: "clan", orden: 4, edadMaxima: 21, archivada: false },
  { id: "scouters", orden: 5, edadMaxima: null, archivada: false },
];

const propuesta = async (agente: Awaited<ReturnType<typeof escenario>>["admin"]) => (await agente.get("/api/cursos/paso").expect(200)).body;

describe("propuesta del paso de curso (D-79, D-80)", () => {
  it("el curso siguiente y la edad que se cumple en el año en que empieza", () => {
    expect(cursoSiguiente("2026-27")).toBe("2027-28");
    expect(cursoSiguiente("2099-00")).toBe("2100-01");
    expect(edadEnCurso(new Date("2019-12-31"), "2027-28")).toBe(8);
    expect(edadEnCurso(null, "2027-28")).toBeNull();
  });

  it("sube quien pasa de la edad máxima de su sección; los demás siguen", () => {
    expect(proponerSeccion(SECCIONES, "castores", 7)).toEqual({ seccionId: "castores", motivo: "SIGUE" });
    expect(proponerSeccion(SECCIONES, "castores", 8)).toEqual({ seccionId: "manada", motivo: "SUBE" });
    // Si por edad le toca saltarse una, va a la que le corresponde.
    expect(proponerSeccion(SECCIONES, "castores", 12)).toEqual({ seccionId: "tropa", motivo: "SUBE" });
  });

  it("sin fecha se queda; los scouters no salen por edad; del Clan se termina", () => {
    expect(proponerSeccion(SECCIONES, "tropa", null)).toEqual({ seccionId: "tropa", motivo: "SIN_FECHA" });
    expect(proponerSeccion(SECCIONES, "scouters", 40)).toEqual({ seccionId: "scouters", motivo: "SIGUE" });
    expect(proponerSeccion(SECCIONES, "clan", 22)).toEqual({ seccionId: null, motivo: "TERMINA" });
  });

  it("se salta las secciones archivadas", () => {
    const sinUnidad = SECCIONES.map((s) => (s.id === "unidad" ? { ...s, archivada: true } : s));
    expect(proponerSeccion(sinUnidad, "tropa", 14)).toEqual({ seccionId: "clan", motivo: "SUBE" });
  });
});

describe("paso de curso (D-79 a D-84)", () => {
  it("propone por edad con los datos del curso activo, sin guardar nada", async () => {
    const { admin, manada, tropa } = await escenario();
    const secciones = await seccionesDe(admin);
    const unidad = secciones.find((s) => s.nombre === "Unidad")!;
    const actual = nombreCursoPara();

    const res = await propuesta(admin);

    expect(res.origen.nombre).toBe(actual);
    expect(res.destino).toBe(cursoSiguiente(actual));
    expect(res.destinoExiste).toBe(false);
    const por = Object.fromEntries(res.filas.map((f: { nombre: string; seccionActualId: string; propuesta: object }) => [f.nombre, [f.seccionActualId, f.propuesta]]));
    expect(por.Mateo).toEqual([manada.id, { seccionId: tropa.id, motivo: "SUBE" }]);
    expect(por.Sara).toEqual([tropa.id, { seccionId: unidad.id, motivo: "SUBE" }]);
    expect(await prisma.curso.count()).toBe(1);
  });

  it("al confirmar crea el curso nuevo, lo activa y matricula solo a los que siguen", async () => {
    const { admin, manada, tropa, sara, mateo, irene } = await escenario();
    const res = await propuesta(admin);

    const hecho = await admin
      .post("/api/cursos/paso")
      .send({
        origenId: res.origen.id,
        filas: [
          { educandoId: sara.id, seccionId: tropa.id },
          { educandoId: mateo.id, seccionId: manada.id },
          { educandoId: irene.id, seccionId: null },
        ],
      })
      .expect(201);

    expect(hecho.body).toMatchObject({ curso: { nombre: res.destino, activo: true }, siguen: 2, terminan: 1 });
    const cursos = (await admin.get("/api/cursos").expect(200)).body.cursos;
    expect(cursos.map((c: { nombre: string; activo: boolean }) => [c.nombre, c.activo])).toEqual([
      [res.destino, true],
      [res.origen.nombre, false],
    ]);
    const ninos = (await admin.get("/api/educandos").expect(200)).body.educandos as { nombre: string }[];
    expect(ninos.map((n) => n.nombre).sort()).toEqual(["Mateo", "Sara"]);
    // El curso anterior conserva sus matrículas.
    expect(await prisma.matricula.count({ where: { cursoId: res.origen.id } })).toBe(3);
  });

  it("no se hace dos veces ni con una lista que no coincide", async () => {
    const { admin, tropa, sara, mateo, irene } = await escenario();
    const res = await propuesta(admin);
    const filas = [sara, mateo, irene].map((e) => ({ educandoId: e.id, seccionId: tropa.id }));

    await admin.post("/api/cursos/paso").send({ origenId: res.origen.id, filas: filas.slice(1) }).expect(400);
    await admin.post("/api/cursos/paso").send({ origenId: res.origen.id, filas: [...filas, filas[0]] }).expect(400);
    await admin.post("/api/cursos/paso").send({ origenId: res.origen.id, filas }).expect(201);
    await admin.post("/api/cursos/paso").send({ origenId: res.origen.id, filas }).expect(409);
  });

  it("no admite secciones de otro grupo ni archivadas", async () => {
    const { admin, tropa, sara, mateo, irene } = await escenario();
    const otro = await grupoConAdmin("Grupo Scout Robledal", "admin@robledal.test");
    const [ajena] = await seccionesDe(otro.admin);
    const castores = (await seccionesDe(admin)).find((s) => s.nombre === "Castores")!;
    await admin.patch(`/api/secciones/${castores.id}`).send({ archivada: true }).expect(200);
    const res = await propuesta(admin);
    const filas = (seccionId: string) => [
      { educandoId: sara.id, seccionId },
      { educandoId: mateo.id, seccionId: tropa.id },
      { educandoId: irene.id, seccionId: tropa.id },
    ];

    await admin.post("/api/cursos/paso").send({ origenId: res.origen.id, filas: filas(ajena.id) }).expect(400);
    await admin.post("/api/cursos/paso").send({ origenId: res.origen.id, filas: filas(castores.id) }).expect(400);
  });

  it("solo un administrador lo ve y lo hace (D-84)", async () => {
    const { admin, sara } = await escenario();
    const tesoreria = await invitarYAceptar(admin, "t@pinar.test", "TESORERIA");
    const { origen } = await propuesta(admin);

    await tesoreria.agente.get("/api/cursos/paso").expect(403);
    await tesoreria.agente.post("/api/cursos/paso").send({ origenId: origen.id, filas: [{ educandoId: sara.id, seccionId: null }] }).expect(403);
  });

  it("otro grupo no ve ni pasa de curso a los niños de este", async () => {
    const { admin, sara, mateo, irene } = await escenario();
    const otro = await grupoConAdmin("Grupo Scout Robledal", "admin@robledal.test");
    const [castores] = await seccionesDe(otro.admin);
    await alta(otro.admin, "Leo", "Prado Sanz", castores.id, { nueva: { responsables: [] } }, "2020-03-03");
    const suya = await propuesta(otro.admin);
    const { origen } = await propuesta(admin);

    expect(suya.filas.map((f: { nombre: string }) => f.nombre)).toEqual(["Leo"]);
    const filas = [sara, mateo, irene].map((e) => ({ educandoId: e.id, seccionId: castores.id }));
    await otro.admin.post("/api/cursos/paso").send({ origenId: origen.id, filas }).expect(409);
    await otro.admin.post("/api/cursos/paso").send({ origenId: suya.origen.id, filas }).expect(400);
  });

  it("sin ningún curso todavía lo dice", async () => {
    const { admin } = await grupoConAdmin();
    const res = await admin.get("/api/cursos/paso").expect(409);
    expect(res.body.error).toMatch(/Todavía no hay ningún curso/);
  });
});

describe("edad máxima de las secciones (D-79)", () => {
  it("un grupo nuevo la trae puesta y un administrador la cambia o la quita", async () => {
    const { admin } = await grupoConAdmin();
    const secciones = await seccionesDe(admin);
    expect(secciones.map((s) => (s as { edadMaxima: number | null }).edadMaxima)).toEqual([7, 10, 13, 16, 21, null]);

    const tropa = secciones.find((s) => s.nombre === "Tropa")!;
    const res = await admin.patch(`/api/secciones/${tropa.id}`).send({ edadMaxima: 14 }).expect(200);
    expect(res.body.seccion.edadMaxima).toBe(14);
    await admin.patch(`/api/secciones/${tropa.id}`).send({ edadMaxima: null }).expect(200);
    const mal = await admin.patch(`/api/secciones/${tropa.id}`).send({ edadMaxima: 7.5 }).expect(400);
    expect(mal.body.campos.edadMaxima).toBe("Escribe una edad sin decimales");
  });
});

describe("deudas de cursos anteriores (D-82)", () => {
  it("un pago del banco cuadra con lo pendiente del curso anterior y la ficha de familia lo muestra", async () => {
    const { admin, manada, tropa, sara, mateo, irene } = await escenario();
    const { origen } = await propuesta(admin);
    await admin
      .post("/api/cursos/paso")
      .send({
        origenId: origen.id,
        filas: [sara, mateo, irene].map((e) => ({ educandoId: e.id, seccionId: e === mateo ? manada.id : tropa.id })),
      })
      .expect(201);

    // Irene debía la cuota (110 €) y el censo (30 €) del curso anterior: 140 € los cuadran (D-43).
    await subir(admin, "confirmar", [[1, "2026-10-02", "CARMEN VIDAL ORTEGA", 140]]).expect(201);

    const clasificados = await lista(admin, "CLASIFICADO");
    expect(clasificados.movimientos.map((m) => [m.concepto, m.cargos.map((c) => c.evento).sort()])).toEqual([
      ["CARMEN VIDAL ORTEGA", ["Censo", "Cuota"]],
    ]);
    const ficha = (await admin.get(`/api/familias/${sara.familiaId}`).expect(200)).body.familia;
    const deSara = ficha.educandos.find((e: { nombre: string }) => e.nombre === "Sara");
    expect(deSara.cargos.map((c: { evento: { nombre: string }; cursoAnterior: string }) => [c.evento.nombre, c.cursoAnterior])).toEqual([
      ["Cuota", origen.nombre],
      ["Censo", origen.nombre],
    ]);
  });
});
