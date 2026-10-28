import type request from "supertest";
import * as XLSX from "xlsx";
import { escenario, subir } from "./escenario-pagos.js";
import { grupoConAdmin, invitarYAceptar } from "./helpers.js";

// Datos inventados (ver escenario-pagos.ts). Tras importar BANCO, las cuotas de Sara, Mateo e Irene y el censo de Irene
// están pagados; los censos de Sara y Mateo siguen pendientes.
type Pago = { origen: string; fecha: string | null; concepto: string; medio: string | null; importeCentimos: number; cruce: unknown };

const binario = (res: request.Response, fin: (err: Error | null, cuerpo: Buffer) => void) => {
  const trozos: Buffer[] = [];
  res.on("data", (t: Buffer) => trozos.push(t));
  res.on("end", () => fin(null, Buffer.concat(trozos)));
};

const exportar = async (agente: request.Agent, eventoId: string, filtros = "") => {
  const res = await agente.get(`/api/eventos/${eventoId}/exportar${filtros}`).buffer(true).parse(binario).expect(200);
  const libro = XLSX.read(res.body as Buffer, { type: "buffer" });
  return { res, filas: XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[libro.SheetNames[0]], { header: 1, defval: "" }) };
};

const conImportados = async () => {
  const datos = await escenario();
  await subir(datos.admin, "confirmar").expect(201);
  return datos;
};

describe("exportar un evento a Excel (D-53, D-54, D-55)", () => {
  it("lleva el resumen y una fila por niño, por orden de sección, con los importes en euros", async () => {
    const { admin, cuota } = await conImportados();

    const { res, filas } = await exportar(admin, cuota);

    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toContain('filename="Cuota.xlsx"');
    expect(filas[0]).toEqual(["Cuota", "", "", "", "", "", ""]);
    expect(filas[1][0]).toMatch(/^Curso .* · 3 niños$/);
    expect(filas[2].slice(0, 4)).toEqual(["Cobrado", 305, "Pendiente", 0]);
    expect(filas[4]).toEqual(["Nombre", "Apellidos", "Sección", "Importe", "Pagado", "Pendiente", "Estado"]);
    expect(filas.slice(5)).toEqual([
      ["Mateo", "Gil Ferrer", "Manada", 85, 85, 0, "Pagado"],
      ["Irene", "Navas Vidal", "Tropa", 110, 110, 0, "Pagado"],
      ["Sara", "Gil Ferrer", "Tropa", 110, 110, 0, "Pagado"],
    ]);
  });

  it("respeta los filtros de estado y sección, y los nombra en el fichero", async () => {
    const { admin, censo, tropa } = await conImportados();

    const { res, filas } = await exportar(admin, censo, `?estado=PENDIENTE&seccionId=${tropa.id}`);

    expect(res.headers["content-disposition"]).toContain("Censo - Tropa.xlsx");
    expect(filas[1][0]).toMatch(/· Tropa · Pendientes · 1 niño$/);
    expect(filas[2].slice(0, 4)).toEqual(["Cobrado", 0, "Pendiente", 30]);
    expect(filas.slice(5)).toEqual([["Sara", "Gil Ferrer", "Tropa", 30, 0, 30, "Pendiente"]]);
  });

  it("un scouter solo exporta sus secciones, y un filtro que no cuadra se rechaza", async () => {
    const { admin, censo, manada } = await conImportados();
    const { agente } = await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [manada.id]);

    const { filas } = await exportar(agente, censo);
    expect(filas.slice(5).map((f) => f[0])).toEqual(["Mateo"]);

    await admin.get(`/api/eventos/${censo}/exportar?estado=DEBE`).expect(400);
  });

  it("no se puede exportar el evento de otro grupo", async () => {
    const { cuota } = await escenario();
    const { admin: otro } = await grupoConAdmin("Grupo Scout Río", "admin@rio.test");
    await otro.get(`/api/eventos/${cuota}/exportar`).expect(404);
  });
});

describe("pagos de un niño en un evento (D-56)", () => {
  it("enseña qué pagos cubren su cargo: fecha, quién, cómo e importe", async () => {
    const { admin, cuota } = await conImportados();
    const sara = ((await admin.get(`/api/eventos/${cuota}`).expect(200)).body.cargos as { id: string; educando: { nombre: string } }[]).find(
      (c) => c.educando.nombre === "Sara",
    )!;

    const { pagos } = (await admin.get(`/api/eventos/${cuota}/cargos/${sara.id}/pagos`).expect(200)).body as { pagos: Pago[] };

    expect(pagos).toEqual([
      expect.objectContaining({ origen: "BANCO", fecha: "2026-10-01", concepto: "FERRER SOTO LUCIA", medio: null, importeCentimos: 11000, cruce: null }),
    ]);
  });

  it("los scouters no lo ven y no sirve para cargos de otro evento", async () => {
    const { admin, cuota, censo, tropa } = await conImportados();
    const cargo = ((await admin.get(`/api/eventos/${censo}`).expect(200)).body.cargos as { id: string }[])[0];
    const { agente } = await invitarYAceptar(admin, "s@pinar.test", "SCOUTER", [tropa.id]);

    await agente.get(`/api/eventos/${censo}/cargos/${cargo.id}/pagos`).expect(403);
    await admin.get(`/api/eventos/${cuota}/cargos/${cargo.id}/pagos`).expect(404);
  });
});
