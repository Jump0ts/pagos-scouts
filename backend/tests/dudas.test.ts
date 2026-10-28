import type request from "supertest";
import { prisma } from "../src/prisma.js";
import { escenario, estados, lista, subir, type Movimiento } from "./escenario-pagos.js";
import { grupoConAdmin, invitarYAceptar } from "./helpers.js";

// Datos inventados (ver escenario-pagos.ts). Tras importar BANCO quedan en Dudas "LUCIA FERRER SOTO" 30 € (el censo
// de cualquiera de sus dos hijos) y "ASOCIACION VECINAL" 50 €; las cuotas ya están pagadas y los censos de la familia
// Gil Ferrer, pendientes.
type Cargo = { id: string; evento: { nombre: string }; estado: string; importeCentimos: number; pagadoCentimos: number };
type Ficha = {
  saldoCentimos: number;
  pagadores: { id: string; nombre: string }[];
  pagos: { origen: string; concepto: string; importeCentimos: number }[];
  educandos: { nombre: string; cargos: Cargo[] }[];
};

const ficha = async (agente: request.Agent, familiaId: string) => (await agente.get(`/api/familias/${familiaId}`).expect(200)).body.familia as Ficha;
const censoDe = async (agente: request.Agent, familiaId: string, nino: string) =>
  (await ficha(agente, familiaId)).educandos.find((e) => e.nombre === nino)!.cargos.find((c) => c.evento.nombre === "Censo")!;
const duda = async (agente: request.Agent, concepto: string) => (await lista(agente, "DUDA")).movimientos.find((m) => m.concepto === concepto)!;

const conImportados = async () => {
  const datos = await escenario();
  await subir(datos.admin, "confirmar").expect(201);
  return datos;
};

describe("resolver una duda (D-5, D-48, D-52)", () => {
  it("reparte entre deudas de una familia, admite pagos parciales y deja el resto como saldo", async () => {
    const { admin, sara, censo } = await conImportados();
    const asociacion = await duda(admin, "ASOCIACION VECINAL");
    const mateo = await censoDe(admin, sara.familiaId, "Mateo");

    await admin
      .post(`/api/movimientos/${asociacion.id}/resolver`)
      .send({ familiaId: sara.familiaId, asignaciones: [{ cargoId: mateo.id, importeCentimos: 3000 }] })
      .expect(200);

    expect(await estados(admin, censo)).toMatchObject({ Mateo: "PAGADO", Sara: "PENDIENTE" });
    const resuelto = (await lista(admin, "CLASIFICADO")).movimientos.find((m) => m.id === asociacion.id) as Movimiento & { sobranteCentimos: number };
    expect(resuelto).toMatchObject({ clasificadoPor: "Admin Pinar", sobranteCentimos: 2000, familia: { nombre: "Familia Gil Ferrer" } });
    expect((await ficha(admin, sara.familiaId)).saldoCentimos).toBe(2000);

    // El saldo se aplica a otra deuda: el censo de Sara queda a medias (20 de 30).
    const deSara = await censoDe(admin, sara.familiaId, "Sara");
    const aplicado = await admin.post(`/api/familias/${sara.familiaId}/saldo/aplicar`).send({ cargoId: deSara.id }).expect(200);
    expect(aplicado.body).toEqual({ aplicadoCentimos: 2000 });
    expect(await censoDe(admin, sara.familiaId, "Sara")).toMatchObject({ estado: "PARCIAL", pagadoCentimos: 2000 });
    expect((await ficha(admin, sara.familiaId)).saldoCentimos).toBe(0);
    await admin.post(`/api/familias/${sara.familiaId}/saldo/aplicar`).send({ cargoId: deSara.id }).expect(400);
  });

  it("valida el reparto: de más, de otra familia o de otro grupo, y no se resuelve dos veces", async () => {
    const { admin, sara, irene } = await conImportados();
    const asociacion = await duda(admin, "ASOCIACION VECINAL");
    const mateo = await censoDe(admin, sara.familiaId, "Mateo");
    const resolver = (cuerpo: object) => admin.post(`/api/movimientos/${asociacion.id}/resolver`).send(cuerpo);

    await resolver({ familiaId: sara.familiaId, asignaciones: [{ cargoId: mateo.id, importeCentimos: 4000 }] }).expect(400);
    await resolver({ familiaId: irene.familiaId, asignaciones: [{ cargoId: mateo.id, importeCentimos: 3000 }] }).expect(400);
    await resolver({ familiaId: "no-existe", asignaciones: [] }).expect(400);

    const { admin: otro } = await grupoConAdmin("Grupo Scout Ribera", "admin@ribera.test");
    await otro.post(`/api/movimientos/${asociacion.id}/resolver`).send({ familiaId: sara.familiaId, asignaciones: [] }).expect(404);

    await resolver({ familiaId: sara.familiaId, asignaciones: [] }).expect(200);
    await resolver({ familiaId: sara.familiaId, asignaciones: [] }).expect(409);
  });
});

describe("recordar al pagador (D-1, D-50)", () => {
  it("aprende el nombre, reintenta sus otras dudas y se puede olvidar", async () => {
    const { admin, sara, censo } = await escenario();
    const abuela: [number, string, string, number][] = [
      [10, "2026-10-10", "ROSARIO QUINTANA ARNEDO", 30],
      [11, "2026-10-11", "ROSARIO QUINTANA ARNEDO", 30],
    ];
    const importado = await subir(admin, "confirmar", abuela).expect(201);
    expect(importado.body).toMatchObject({ clasificados: 0, dudas: 2 });

    const [primera] = (await lista(admin, "DUDA")).movimientos.filter((m) => m.concepto === "ROSARIO QUINTANA ARNEDO").sort((a, b) => a.id.localeCompare(b.id));
    const detalle = await admin.get(`/api/movimientos/${primera.id}`).expect(200);
    expect(detalle.body).toMatchObject({ pagadorConocido: null, candidatosCruce: [] });

    const deSara = await censoDe(admin, sara.familiaId, "Sara");
    const res = await admin
      .post(`/api/movimientos/${primera.id}/resolver`)
      .send({ familiaId: sara.familiaId, asignaciones: [{ cargoId: deSara.id, importeCentimos: 3000 }], recordarPagador: true })
      .expect(200);

    // La otra duda de la abuela ya solo puede ser el censo de Mateo: se clasifica sola.
    expect(res.body).toEqual({ reintentadas: 1 });
    expect(await estados(admin, censo)).toMatchObject({ Mateo: "PAGADO", Sara: "PAGADO" });
    const { pagadores } = await ficha(admin, sara.familiaId);
    expect(pagadores).toEqual([expect.objectContaining({ nombre: "ROSARIO QUINTANA ARNEDO" })]);

    // Olvidado, sus pagos siguientes vuelven a ser de un pagador desconocido.
    await admin.delete(`/api/familias/${sara.familiaId}/pagadores/${pagadores[0].id}`).expect(204);
    const otra = await subir(admin, "analizar", [[12, "2026-10-12", "ROSARIO QUINTANA ARNEDO", 30]]).expect(200);
    expect(otra.body.movimientos[0]).toMatchObject({ motivo: "PAGADOR_DESCONOCIDO" });
  });
});

describe("otros ingresos (D-49)", () => {
  it("saca de Dudas lo que no es de familias, con su nota, y se puede deshacer", async () => {
    const { admin } = await conImportados();
    const asociacion = await duda(admin, "ASOCIACION VECINAL");

    await admin.post(`/api/movimientos/${asociacion.id}/otro-ingreso`).send({ nota: "Ayuda para el campamento" }).expect(204);
    const otros = await lista(admin, "OTRO_INGRESO");
    expect(otros.contadores).toEqual({ dudas: 1, clasificados: 2, otros: 1 });
    expect(otros.movimientos[0]).toMatchObject({ concepto: "ASOCIACION VECINAL", nota: "Ayuda para el campamento" });

    await admin.post(`/api/movimientos/${asociacion.id}/deshacer`).expect(204);
    expect(await duda(admin, "ASOCIACION VECINAL")).toMatchObject({ motivo: "DESHECHO" });
  });
});

describe("pago a mano y cruce con el banco (D-46, D-51)", () => {
  it("apunta un pago a mano y, si luego llega por el banco, se cruza sin contarlo dos veces", async () => {
    const { admin, sara, censo } = await escenario();
    const deSara = await censoDe(admin, sara.familiaId, "Sara");
    await admin
      .post("/api/movimientos")
      .send({ fecha: "2026-10-05", concepto: "Lucía en la reunión", importeCentimos: 3000, medio: "EFECTIVO", familiaId: sara.familiaId, asignaciones: [{ cargoId: deSara.id, importeCentimos: 3000 }] })
      .expect(201);
    expect(await estados(admin, censo)).toMatchObject({ Sara: "PAGADO", Mateo: "PENDIENTE" });

    // Llega el mismo dinero por el banco: cuadraría con el censo de Mateo, pero puede ser el ya apuntado.
    await subir(admin, "confirmar", [[20, "2026-10-20", "LUCIA FERRER SOTO", 30]]).expect(201);
    const delBanco = await duda(admin, "LUCIA FERRER SOTO");
    expect(delBanco).toMatchObject({ motivo: "POSIBLE_YA_APUNTADO" });
    const detalle = await admin.get(`/api/movimientos/${delBanco.id}`).expect(200);
    expect(detalle.body.candidatosCruce).toEqual([expect.objectContaining({ origen: "MANUAL", medio: "EFECTIVO", importeCentimos: 3000 })]);

    await admin.post(`/api/movimientos/${delBanco.id}/cruzar`).send({ movimientoId: detalle.body.candidatosCruce[0].id }).expect(204);
    const clasificados = await lista(admin, "CLASIFICADO");
    expect(clasificados.movimientos).toHaveLength(1);
    expect(clasificados.movimientos[0]).toMatchObject({ id: delBanco.id, cruce: { origen: "MANUAL" }, cargos: [{ educando: "Sara" }] });
    expect(await estados(admin, censo)).toMatchObject({ Sara: "PAGADO", Mateo: "PENDIENTE" });
    expect((await ficha(admin, sara.familiaId)).pagos).toEqual([expect.objectContaining({ origen: "BANCO", importeCentimos: 3000 })]);

    // Deshacer el del banco devuelve todo como estaba.
    await admin.post(`/api/movimientos/${delBanco.id}/deshacer`).expect(204);
    expect(await duda(admin, "LUCIA FERRER SOTO")).toMatchObject({ motivo: "POSIBLE_YA_APUNTADO" });
    const manual = (await lista(admin, "CLASIFICADO")).movimientos[0];
    expect(manual).toMatchObject({ origen: "MANUAL", cargos: [{ educando: "Sara" }] });
    expect(await estados(admin, censo)).toMatchObject({ Sara: "PAGADO" });

    // Y un pago a mano se deshace borrándolo.
    await admin.post(`/api/movimientos/${manual.id}/deshacer`).expect(204);
    expect(await estados(admin, censo)).toMatchObject({ Sara: "PENDIENTE" });
  });

  it("valida el pago a mano y una familia con saldo no se puede borrar", async () => {
    const { admin, sara, tropa } = await escenario();
    const base = { fecha: "2026-10-05", concepto: "Bizum de Andrés", importeCentimos: 5000, medio: "BIZUM", familiaId: sara.familiaId, asignaciones: [] };
    await admin.post("/api/movimientos").send({ ...base, importeCentimos: 0 }).expect(400);
    await admin.post("/api/movimientos").send({ ...base, familiaId: "" }).expect(400);
    await admin.post("/api/movimientos").send({ ...base, medio: "CHEQUE" }).expect(400);

    await admin.post("/api/movimientos").send(base).expect(201);
    expect((await ficha(admin, sara.familiaId)).saldoCentimos).toBe(5000);
    await admin.delete(`/api/familias/${sara.familiaId}`).expect(409);

    const { agente } = await invitarYAceptar(admin, "scouter@pinar.test", "SCOUTER", [tropa.id]);
    await agente.post("/api/movimientos").send(base).expect(403);
    expect(await prisma.movimiento.count()).toBe(1);
  });
});
