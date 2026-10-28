import type { Prisma } from "@prisma/client";
import { persona, tokens } from "../../utils/nombres.js";
import { cursoActivo } from "../cursos/cursos.utils.js";
import { importeDe } from "../eventos/cargos.utils.js";
import type { BancoLeido, MovimientoLeido } from "./banco.parser.js";
import { clasificar, clavePagador, descontar, type Apuntado, type CargoPendiente, type Contexto } from "./clasificacion.js";
import type { CargoDeMovimiento, ResumenImportacion } from "./movimientos.types.js";

type Db = Prisma.TransactionClient;

/** Todo lo que necesita el motor: familias, pagadores aprendidos y lo pendiente del curso activo (D-43). */
export const cargarContexto = async (db: Db, grupoId: string) => {
  const curso = await cursoActivo(grupoId, db);
  const [familias, pagadores, cargos, marcadas, apuntados] = await Promise.all([
    db.familia.findMany({
      where: { grupoId },
      select: { id: true, nombre: true, responsables: { select: { nombreCompleto: true } }, educandos: { select: { apellidos: true } } },
    }),
    db.pagador.findMany({ where: { grupoId }, select: { clave: true, familiaId: true } }),
    curso
      ? db.cargo.findMany({
          where: { estado: "ACTIVO", evento: { grupoId, cursoId: curso.id } },
          select: {
            id: true,
            importeCalculadoCentimos: true,
            importeAjustadoCentimos: true,
            evento: { select: { nombre: true, fechaInicio: true } },
            educando: { select: { nombre: true, apellidos: true, familiaId: true } },
            asignaciones: { select: { importeCentimos: true } },
          },
        })
      : [],
    db.movimiento.findMany({ where: { grupoId, origen: "LISTADO", familiaId: { not: null } }, select: { familiaId: true } }),
    // D-51: lo apuntado a mano o marcado en el listado que todavia no se ha cruzado con el banco.
    db.movimiento.findMany({
      where: { grupoId, origen: { in: ["MANUAL", "LISTADO"] }, estado: "CLASIFICADO", cruzadoConId: null, familiaId: { not: null } },
      select: { id: true, origen: true, importeCentimos: true, familiaId: true },
      orderBy: { creadoEn: "asc" },
    }),
  ]);
  const apuntadosPorFamilia = new Map<string, Apuntado[]>();
  for (const a of apuntados) {
    const lista = apuntadosPorFamilia.get(a.familiaId!) ?? [];
    lista.push({ id: a.id, origen: a.origen as Apuntado["origen"], importeCentimos: a.importeCentimos });
    apuntadosPorFamilia.set(a.familiaId!, lista);
  }

  const pendientes = new Map<string, CargoPendiente[]>();
  const cargosPorId = new Map<string, Omit<CargoDeMovimiento, "importeCentimos">>();
  for (const c of cargos) {
    cargosPorId.set(c.id, { cargoId: c.id, evento: c.evento.nombre, educando: c.educando.nombre });
    const pendiente = importeDe(c) - c.asignaciones.reduce((n, a) => n + a.importeCentimos, 0);
    if (pendiente <= 0) continue;
    const familiaId = c.educando.familiaId;
    pendientes.set(familiaId, [
      ...(pendientes.get(familiaId) ?? []),
      { cargoId: c.id, pendienteCentimos: pendiente, orden: c.evento.fechaInicio.getTime() },
    ]);
  }

  const contexto: Contexto = {
    pagadores: new Map(pagadores.map((p) => [p.clave, p.familiaId])),
    familias: familias.map((f) => ({
      id: f.id,
      responsables: f.responsables.map((r) => persona(r.nombreCompleto)),
      apellidosHijos: [...new Set(f.educandos.flatMap((e) => tokens(e.apellidos)))],
    })),
    pendientes,
    conMarcas: new Set(marcadas.map((m) => m.familiaId!)),
    apuntados: apuntadosPorFamilia,
  };
  return { contexto, familias: new Map(familias.map((f) => [f.id, f.nombre])), cargosPorId };
};

const aTexto = (f: Date) => f.toISOString().slice(0, 10);

/**
 * D-50: tras aprender un pagador, sus otras dudas del banco vuelven a pasar por el motor. Las que ahora cuadran sin
 * duda se clasifican; el resto se queda en Dudas con la sugerencia al dia. Las deshechas a mano no se tocan.
 */
export const reintentarDudas = async (db: Db, grupoId: string, clave: string) => {
  const dudas = await db.movimiento.findMany({
    where: { grupoId, origen: "BANCO", estado: "DUDA", NOT: { motivoDuda: "DESHECHO" } },
    orderBy: [{ fecha: "asc" }, { numeroBanco: "asc" }],
  });
  const suyas = dudas.filter((d) => clavePagador(d.concepto) === clave);
  if (!suyas.length) return 0;
  const { contexto } = await cargarContexto(db, grupoId);
  let clasificadas = 0;
  for (const d of suyas) {
    const r = clasificar(d.concepto, d.importeCentimos, contexto);
    if (r.estado === "CLASIFICADO") {
      descontar(contexto, r.familiaId, r.asignaciones);
      clasificadas += 1;
    }
    await db.movimiento.update({
      where: { id: d.id },
      data: {
        estado: r.estado,
        motivoDuda: r.estado === "DUDA" ? r.motivo : null,
        familiaId: r.familiaId,
        cargosSugeridos: r.estado === "DUDA" ? r.cargosSugeridos : [],
        clasificadoEn: r.estado === "CLASIFICADO" ? new Date() : null,
        ...(r.estado === "CLASIFICADO" && { asignaciones: { create: r.asignaciones } }),
      },
    });
  }
  return clasificadas;
};

// Un cargo sugerido en Dudas, con lo que le falta por pagar.
const pendienteDe = (contexto: Contexto, familiaId: string | null, cargoId: string) => ({
  cargoId,
  importeCentimos: contexto.pendientes.get(familiaId ?? "")?.find((c) => c.cargoId === cargoId)?.pendienteCentimos ?? 0,
});

// D-45: Nº mov, fecha e importe. Sin Nº mov (otros bancos), tambien el concepto.
const claveDe = (m: { numero: number | null; fecha: Date; importeCentimos: number; concepto: string }) =>
  [m.numero ?? `-${m.concepto}`, aTexto(m.fecha), m.importeCentimos].join("|");

/**
 * Clasifica los ingresos nuevos del Excel por orden de fecha (D-43). Con `guardar` los guarda (dentro de la
 * transaccion de quien llama); sin el, solo dice lo que pasaria.
 */
export const importarMovimientos = async (
  db: Db,
  grupoId: string,
  leido: BancoLeido,
  guardar: { usuarioId: string } | null,
): Promise<ResumenImportacion> => {
  const fechas = leido.ingresos.map((m) => m.fecha.getTime());
  const existentes = leido.ingresos.length
    ? await db.movimiento.findMany({
        where: { grupoId, origen: "BANCO", fecha: { gte: new Date(Math.min(...fechas)), lte: new Date(Math.max(...fechas)) } },
        select: { numeroBanco: true, fecha: true, importeCentimos: true, concepto: true },
      })
    : [];
  const vistos = new Set(existentes.map((e) => claveDe({ ...e, numero: e.numeroBanco, fecha: e.fecha! })));

  const nuevos: MovimientoLeido[] = [];
  for (const m of leido.ingresos) {
    const clave = claveDe(m);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    nuevos.push(m);
  }
  nuevos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || (a.numero ?? 0) - (b.numero ?? 0));

  const { contexto, familias, cargosPorId } = await cargarContexto(db, grupoId);
  const resumen: ResumenImportacion = {
    nuevos: nuevos.length,
    yaImportados: leido.ingresos.length - nuevos.length,
    salidasIgnoradas: leido.salidas,
    clasificados: 0,
    dudas: 0,
    desde: leido.ingresos.length ? aTexto(new Date(Math.min(...fechas))) : null,
    hasta: leido.ingresos.length ? aTexto(new Date(Math.max(...fechas))) : null,
    movimientos: [],
  };

  for (const m of nuevos) {
    const resultado = clasificar(m.concepto, m.importeCentimos, contexto);
    const asignaciones = resultado.estado === "CLASIFICADO" ? resultado.asignaciones : [];
    if (resultado.estado === "CLASIFICADO") {
      descontar(contexto, resultado.familiaId, asignaciones);
      resumen.clasificados += 1;
    } else {
      resumen.dudas += 1;
    }
    const sugeridos = resultado.estado === "DUDA" ? resultado.cargosSugeridos : [];

    if (guardar) {
      await db.movimiento.create({
        data: {
          grupoId,
          origen: "BANCO",
          numeroBanco: m.numero,
          fecha: m.fecha,
          concepto: m.concepto,
          importeCentimos: m.importeCentimos,
          estado: resultado.estado,
          motivoDuda: resultado.estado === "DUDA" ? resultado.motivo : null,
          familiaId: resultado.familiaId,
          cargosSugeridos: sugeridos,
          clasificadoEn: resultado.estado === "CLASIFICADO" ? new Date() : null,
          importadoPorId: guardar.usuarioId,
          asignaciones: { create: asignaciones },
        },
      });
    }

    resumen.movimientos.push({
      fecha: aTexto(m.fecha),
      concepto: m.concepto,
      importeCentimos: m.importeCentimos,
      estado: resultado.estado,
      motivo: resultado.estado === "DUDA" ? resultado.motivo : null,
      familia: resultado.familiaId ? { id: resultado.familiaId, nombre: familias.get(resultado.familiaId) ?? "" } : null,
      cargos: (asignaciones.length ? asignaciones : sugeridos.map((id) => pendienteDe(contexto, resultado.familiaId, id))).flatMap((a) => {
        const cargo = cargosPorId.get(a.cargoId);
        return cargo ? [{ ...cargo, importeCentimos: a.importeCentimos }] : [];
      }),
    });
  }
  return resumen;
};
