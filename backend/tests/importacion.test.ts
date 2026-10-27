import request from "supertest";
import * as XLSX from "xlsx";
import { interpretarListado, leerFilas } from "../src/modules/importaciones/listado.parser.js";
import { prisma } from "../src/prisma.js";
import { app, grupoConAdmin, invitarYAceptar, seccionesDe } from "./helpers.js";

// Listado INVENTADO con la forma del de un grupo real: cabecera repetida por bloque, columnas de pagos,
// filas vacias o con "?", hermanos en bloques distintos, una errata en los padres y niños sin padres.
const CABECERA = ["Nombres padres", "Educando", "Pago del censo", "Pago cuota"];
const LISTADO: string[][] = [
  CABECERA,
  [],
  CABECERA,
  ["Lucía Ferrer Soto / Andrés Gil Rubio", "Mateo Gil Ferrer", "Pagado", ""],
  ["Carmen Vidal Ortega", "Irene Navas Vidal", "", ""],
  ["", "Bruno"],
  ["", "?"],
  CABECERA,
  ["Lucía Ferrer Soto/Andrés Gil Rubio", "Sara Gil Ferrer", "", "Pagado"],
  ["Rosa Castillo Rojo", "Leo Díaz Castillo"],
  ["Rosa Castilo Rojo", "Nora Díaz Castillo"],
];

const excel = (filas: string[][]) => {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), "Hoja 1");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
};

const analizar = (agente: request.Agent, filas: string[][]) =>
  agente.post("/api/importaciones/listado/analizar").set("Content-Type", "application/octet-stream").send(excel(filas));

type Propuesta = {
  familias: { existenteId: string | null; nombre: string; responsables: string[]; avisos: string[]; ninos: { existenteId: string | null; nombre: string; apellidos: string; bloque: number }[] }[];
  bloques: { indice: number; total: number }[];
  noAparecen: { nombre: string }[];
};

const confirmar = (agente: request.Agent, propuesta: Propuesta, secciones: Record<string, string>, curso = "2026-27") =>
  agente.post("/api/importaciones/listado/confirmar").send({
    curso,
    secciones,
    familias: propuesta.familias.map(({ avisos: _, ...f }) => f),
  });

describe("lectura del listado", () => {
  it("detecta un bloque por cabecera repetida, ignora filas vacias y '?' y lee las marcas de pago", () => {
    const leido = interpretarListado(leerFilas(excel(LISTADO)));

    expect(leido.bloques).toBe(2);
    expect(leido.filas.map((f) => [f.bloque, f.nino])).toEqual([
      [0, "Mateo Gil Ferrer"], [0, "Irene Navas Vidal"], [0, "Bruno"],
      [1, "Sara Gil Ferrer"], [1, "Leo Díaz Castillo"], [1, "Nora Díaz Castillo"],
    ]);
    expect(leido.filas[0].responsables).toEqual(["Lucía Ferrer Soto", "Andrés Gil Rubio"]);
    expect(leido.columnasIgnoradas).toEqual(["Pago del censo", "Pago cuota"]);
    // D-44: las marcas "Pagado", por columna y por niño.
    expect(leido.columnasPago).toEqual([
      { clave: "PAGO DEL CENSO", titulo: "Pago del censo", marcas: 1 },
      { clave: "PAGO CUOTA", titulo: "Pago cuota", marcas: 1 },
    ]);
    expect(leido.filas.map((f) => f.pagado)).toEqual([["PAGO DEL CENSO"], [], [], ["PAGO CUOTA"], [], []]);
  });

  it.each([
    ["UTF-8 sin BOM", Buffer.from("Padres,Educando\nRosa Castillo Rojo,Leo Díaz Castillo\n", "utf8")],
    ["UTF-8 con BOM", Buffer.from("﻿Padres,Educando\nRosa Castillo Rojo,Leo Díaz Castillo\n", "utf8")],
    ["Windows-1252", Buffer.from("Padres,Educando\nRosa Castillo Rojo,Leo Díaz Castillo\n", "latin1")],
  ])("lee las tildes de un CSV en %s", (_, contenido) => {
    expect(interpretarListado(leerFilas(contenido)).filas[0].nino).toBe("Leo Díaz Castillo");
  });

  it("sin cabecera usa las columnas A y B", () => {
    const leido = interpretarListado([["Carmen Vidal Ortega", "Irene Navas Vidal"]]);
    expect(leido.filas).toEqual([{ fila: 1, bloque: 0, nino: "Irene Navas Vidal", responsables: ["Carmen Vidal Ortega"], pagado: [] }]);
  });

  it("rechaza ficheros que no son una hoja de calculo", async () => {
    const { admin } = await grupoConAdmin();
    const res = await admin
      .post("/api/importaciones/listado/analizar")
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from([0x00, 0x01, 0x02, 0xff]));
    expect(res.status).toBe(400);
  });
});

describe("analisis y confirmacion", () => {
  it("une hermanos de bloques distintos y familias con erratas, y avisa de lo que hay que revisar", async () => {
    const { admin } = await grupoConAdmin();

    const res = await analizar(admin, LISTADO).expect(200);
    const familias = (res.body as Propuesta).familias;

    expect(res.body.bloques).toEqual([{ indice: 0, total: 3, ejemplos: ["Mateo Gil Ferrer", "Irene Navas Vidal", "Bruno"] }, { indice: 1, total: 3, ejemplos: ["Sara Gil Ferrer", "Leo Díaz Castillo", "Nora Díaz Castillo"] }]);
    expect(familias.map((f) => f.ninos.map((n) => n.nombre))).toEqual([["Mateo", "Sara"], ["Irene"], ["Bruno"], ["Leo", "Nora"]]);
    expect(familias[0]).toMatchObject({ nombre: "Familia Gil Ferrer", responsables: ["Lucía Ferrer Soto", "Andrés Gil Rubio"] });
    expect(familias[2].avisos[0]).toMatch(/Sin responsables/);
    expect(familias[3].avisos[0]).toMatch(/parece la misma familia/);
    expect(await prisma.educando.count()).toBe(0); // analizar no guarda nada
  });

  it("guarda familias, niños y matriculas en el curso, que pasa a ser el activo", async () => {
    const { admin } = await grupoConAdmin();
    const secciones = await seccionesDe(admin);
    const propuesta = (await analizar(admin, LISTADO).expect(200)).body as Propuesta;

    const res = await confirmar(admin, propuesta, { 0: secciones[1].id, 1: secciones[2].id }).expect(201);

    expect(res.body).toMatchObject({ curso: { nombre: "2026-27" }, familiasNuevas: 4, ninosNuevos: 6, ninosActualizados: 0 });
    const lista = (await admin.get("/api/educandos").expect(200)).body;
    expect(lista.curso.nombre).toBe("2026-27");
    expect(lista.educandos).toHaveLength(6);
    const sara = lista.educandos.find((e: { nombre: string }) => e.nombre === "Sara");
    const mateo = lista.educandos.find((e: { nombre: string }) => e.nombre === "Mateo");
    expect(sara.seccionId).toBe(secciones[2].id);
    expect(mateo.seccionId).toBe(secciones[1].id);
    expect(sara.familia.id).toBe(mateo.familia.id);
  });

  it("al reimportar reconoce lo existente, actualiza secciones y señala a quien no aparece", async () => {
    const { admin } = await grupoConAdmin();
    const secciones = await seccionesDe(admin);
    await confirmar(admin, (await analizar(admin, LISTADO)).body, { 0: secciones[1].id, 1: secciones[2].id }).expect(201);

    // Un año despues: Bruno ya no esta, Irene viene con una errata y aparece un niño nuevo.
    const siguiente = [CABECERA, ["Carmen Vidal Ortega", "Irene Nabas Vidal"], ["Lucía Ferrer Soto / Andrés Gil Rubio", "Mateo Gil Ferrer"], ["Pablo Ruiz Calvo / Marta Calvo Gil", "Hugo Ruiz Calvo"]];
    const propuesta = (await analizar(admin, siguiente).expect(200)).body as Propuesta;

    expect(propuesta.familias.map((f) => f.ninos[0].existenteId !== null)).toEqual([true, true, false]);
    expect(propuesta.familias[1].existenteId).not.toBeNull();
    expect(propuesta.noAparecen.map((n) => n.nombre).sort()).toEqual(["Bruno", "Leo Díaz Castillo", "Nora Díaz Castillo", "Sara Gil Ferrer"]);

    const res = await confirmar(admin, propuesta, { 0: secciones[3].id }).expect(201);
    expect(res.body).toMatchObject({ familiasNuevas: 1, ninosNuevos: 1, ninosActualizados: 2 });
    expect(await prisma.educando.count()).toBe(7);
    const irene = await prisma.educando.findFirstOrThrow({ where: { nombre: "Irene" }, include: { matriculas: true } });
    expect(irene.apellidos).toBe("Navas Vidal"); // no se cambia el nombre guardado por la errata
    expect(irene.matriculas[0].seccionId).toBe(secciones[3].id);
  });

  it("exige la seccion de cada bloque usado", async () => {
    const { admin } = await grupoConAdmin();
    const secciones = await seccionesDe(admin);
    const propuesta = (await analizar(admin, LISTADO)).body as Propuesta;

    const res = await confirmar(admin, propuesta, { 0: secciones[0].id });

    expect(res.status).toBe(400);
    expect(res.body.campos.secciones).toBeDefined();
  });

  it("no acepta referencias a niños ni familias de otro grupo", async () => {
    const pinar = await grupoConAdmin("Grupo Scout Pinar", "admin@pinar.test");
    const rio = await grupoConAdmin("Grupo Scout Rio", "admin@rio.test");
    const seccionesRio = await seccionesDe(rio.admin);
    await confirmar(rio.admin, (await analizar(rio.admin, LISTADO)).body, { 0: seccionesRio[0].id, 1: seccionesRio[1].id }).expect(201);
    const ajeno = await prisma.educando.findFirstOrThrow();

    const seccionesPinar = await seccionesDe(pinar.admin);
    const res = await pinar.admin.post("/api/importaciones/listado/confirmar").send({
      curso: "2026-27",
      secciones: { 0: seccionesPinar[0].id },
      familias: [{ existenteId: ajeno.familiaId, nombre: "Familia X", responsables: [], ninos: [{ existenteId: ajeno.id, nombre: "X", apellidos: "", bloque: 0 }] }],
    });

    expect(res.status).toBe(400);
  });

  it("los scouters no pueden importar", async () => {
    const { admin } = await grupoConAdmin();
    const [tropa] = await seccionesDe(admin);
    const scouter = await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [tropa.id]);

    await analizar(scouter.agente, LISTADO).expect(403);
  });

  it("sin sesion, nada", async () => {
    await request(app).post("/api/importaciones/listado/analizar").expect(401);
  });
});
