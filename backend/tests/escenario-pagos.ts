import type request from "supertest";
import { excelBanco, type MovimientoFicticio } from "./fixtures/banco.js";
import { grupoConAdmin, seccionesDe } from "./helpers.js";

// Datos inventados. Familia Gil Ferrer (Lucía Ferrer Soto y Andrés Gil Rubio): Sara (Tropa, la mayor) y Mateo
// (Manada). Familia Navas Vidal (Carmen Vidal Ortega): Irene (Tropa). Cuota 110 € con 2º hermano a 85 €; censo 30 €.
export type Seccion = { id: string; nombre: string };
export type Movimiento = { id: string; concepto: string; estado: string; motivo: string | null; familia: { nombre: string } | null; cargos: { educando: string; evento: string; importeCentimos: number }[]; clasificadoPor: string | null };

export const alta = async (agente: request.Agent, nombre: string, apellidos: string, seccionId: string, familia: object, fechaNacimiento: string) =>
  (await agente.post("/api/educandos").send({ nombre, apellidos, seccionId, fechaNacimiento, familia }).expect(201)).body.educando as {
    id: string;
    familiaId: string;
  };

export const evento = (nombre: string, secciones: Seccion[], importe: number, hermanos = false) => ({
  nombre,
  tipo: "TODA_SECCION",
  fechaInicio: "2026-09-01",
  fechaFin: "2099-12-31",
  precios: secciones.map((s) => ({ seccionId: s.id, importeCentimos: importe })),
  descuentoHermanos: hermanos,
  ...(hermanos && { precioSegundoCentimos: 8500 }),
});

export const escenario = async () => {
  const { admin } = await grupoConAdmin();
  const [, manada, tropa] = (await seccionesDe(admin)) as Seccion[];
  const sara = await alta(admin, "Sara", "Gil Ferrer", tropa.id, { nueva: { responsables: ["Lucía Ferrer Soto", "Andrés Gil Rubio"] } }, "2013-02-10");
  const mateo = await alta(admin, "Mateo", "Gil Ferrer", manada.id, { id: sara.familiaId }, "2016-09-20");
  const irene = await alta(admin, "Irene", "Navas Vidal", tropa.id, { nueva: { responsables: ["Carmen Vidal Ortega"] } }, "2013-05-02");
  const cuota = (await admin.post("/api/eventos").send(evento("Cuota", [manada, tropa], 11000, true)).expect(201)).body.evento.id as string;
  const censo = (await admin.post("/api/eventos").send(evento("Censo", [manada, tropa], 3000)).expect(201)).body.evento.id as string;
  return { admin, manada, tropa, sara, mateo, irene, cuota, censo };
};

export const BANCO: MovimientoFicticio[] = [
  [5, "2026-10-05", "COMISION MANTENIMIENTO", -5],
  [4, "2026-10-04", "ASOCIACION VECINAL", 50],
  [3, "2026-10-03", "LUCIA FERRER SOTO", 30],
  [2, "2026-10-02", "CARMEN VIDAL ORTEGA", 140],
  [1, "2026-10-01", "FERRER SOTO LUCIA", 195],
];

export const subir = (agente: request.Agent, paso: "analizar" | "confirmar", movimientos = BANCO) =>
  agente.post(`/api/movimientos/importar/${paso}`).set("Content-Type", "application/octet-stream").send(excelBanco(movimientos));

export const lista = async (agente: request.Agent, estado: "DUDA" | "CLASIFICADO" | "OTRO_INGRESO") =>
  (await agente.get(`/api/movimientos?estado=${estado}`).expect(200)).body as {
    contadores: { dudas: number; clasificados: number; otros: number };
    movimientos: Movimiento[];
  };

export const estados = async (agente: request.Agent, eventoId: string) =>
  Object.fromEntries(
    ((await agente.get(`/api/eventos/${eventoId}`).expect(200)).body.cargos as { educando: { nombre: string }; estado: string }[]).map((c) => [
      c.educando.nombre,
      c.estado,
    ]),
  );
