import type { Prisma } from "@prisma/client";
import { cursoActivo } from "../cursos/cursos.utils.js";
import { calcularCargos } from "./cargos.calculo.js";
import { pagadoPorCargo } from "./cargos.utils.js";

const hoy = () => {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
};

// ajustados: los que conservan su importe por tener un ajuste a mano o algun pago (D-37).
export type ResumenSincronizacion = { recalculados: number; ajustados: number };

/**
 * D-36: deja los cargos de los eventos del curso activo de acuerdo con las matriculas, y recalcula importes y
 * posiciones de hermanos (D-34, D-37). Se llama tras cualquier cambio en eventos, niños, secciones o bajas.
 * Los cargos con algun pago no se anulan ni cambian de importe (D-36), pero siguen contando como hermanos.
 */
export const sincronizarCargos = async (
  tx: Prisma.TransactionClient,
  grupoId: string,
  soloEventoId?: string,
  // Al crear el evento o cambiar sus secciones, los niños actuales reciben cargo aunque el evento ya haya
  // terminado (p. ej. apuntar una acampada pasada); la regla de "evento abierto" es para los que entran despues.
  { generarAunqueCerrado = false } = {},
): Promise<ResumenSincronizacion> => {
  const resumen = { recalculados: 0, ajustados: 0 };
  const curso = await cursoActivo(grupoId, tx);
  if (!curso) return resumen;

  const eventos = await tx.evento.findMany({
    where: { grupoId, cursoId: curso.id, ...(soloEventoId && { id: soloEventoId }) },
    include: { precios: true, cargos: true },
  });
  if (!eventos.length) return resumen;

  const matriculas = await tx.matricula.findMany({
    where: { cursoId: curso.id },
    select: {
      educandoId: true,
      seccionId: true,
      bajaEn: true,
      seccion: { select: { orden: true } },
      educando: { select: { nombre: true, apellidos: true, familiaId: true, fechaNacimiento: true } },
    },
  });
  const matriculaDe = new Map(matriculas.map((m) => [m.educandoId, m]));
  const pagados = await pagadoPorCargo(eventos.flatMap((e) => e.cargos.map((c) => c.id)), tx);
  const abiertoDesde = hoy();

  for (const evento of eventos) {
    const precios = new Map(evento.precios.map((p) => [p.seccionId, p.importeCentimos]));
    const cargoDe = new Map(evento.cargos.map((c) => [c.educandoId, c]));
    const abierto = generarAunqueCerrado || evento.fechaFin >= abiertoDesde;

    // Altas, reincorporaciones y cambios de seccion.
    for (const m of matriculas) {
      if (m.bajaEn || !precios.has(m.seccionId)) continue;
      const cargo = cargoDe.get(m.educandoId);
      if (!cargo) {
        if (evento.tipo === "TODA_SECCION" && abierto) {
          const creado = await tx.cargo.create({
            data: { eventoId: evento.id, educandoId: m.educandoId, seccionId: m.seccionId, importeCalculadoCentimos: 0 },
          });
          cargoDe.set(m.educandoId, creado);
        }
      } else if (cargo.estado === "ANULADO" || (cargo.estado === "ACTIVO" && cargo.seccionId !== m.seccionId)) {
        const actualizado = await tx.cargo.update({ where: { id: cargo.id }, data: { estado: "ACTIVO", seccionId: m.seccionId } });
        cargoDe.set(m.educandoId, actualizado);
      }
    }

    // Bajas y secciones que ya no estan en el evento: se anula lo pendiente.
    for (const cargo of cargoDe.values()) {
      if (cargo.estado !== "ACTIVO") continue;
      const m = matriculaDe.get(cargo.educandoId);
      if ((!m || m.bajaEn || !precios.has(m.seccionId)) && !pagados.has(cargo.id)) {
        const anulado = await tx.cargo.update({ where: { id: cargo.id }, data: { estado: "ANULADO" } });
        cargoDe.set(cargo.educandoId, anulado);
      }
    }

    // Importes y posiciones de hermanos con los cargos activos.
    const activos = [...cargoDe.values()].filter((c) => c.estado === "ACTIVO");
    const calculo = calcularCargos(
      activos.map((c) => {
        // Un cargo con pagos sigue activo aunque el niño se haya ido, y sigue contando como hermano: si el mayor
        // ya pago el precio completo, el pequeño no pasa a pagarlo tambien.
        const m = matriculaDe.get(c.educandoId);
        return {
          cargoId: c.id,
          familiaId: m?.educando.familiaId ?? `sin-matricula-${c.id}`,
          seccionId: c.seccionId,
          ordenSeccion: m?.seccion.orden ?? 0,
          fechaNacimiento: m?.educando.fechaNacimiento ?? null,
          nombre: m ? `${m.educando.nombre} ${m.educando.apellidos}` : "",
        };
      }),
      {
        preciosPorSeccion: precios,
        descuentoHermanos: evento.descuentoHermanos,
        precioSegundoCentimos: evento.precioSegundoCentimos,
        precioTerceroCentimos: evento.precioTerceroCentimos,
      },
    );
    for (const c of activos) {
      const nuevo = calculo.get(c.id)!;
      if (c.importeAjustadoCentimos !== null || pagados.has(c.id)) resumen.ajustados += 1;
      if (pagados.has(c.id)) continue;
      if (nuevo.importeCentimos !== c.importeCalculadoCentimos || nuevo.posicion !== c.posicionHermano) {
        await tx.cargo.update({
          where: { id: c.id },
          data: { importeCalculadoCentimos: nuevo.importeCentimos, posicionHermano: nuevo.posicion },
        });
        if (c.importeAjustadoCentimos === null) resumen.recalculados += 1;
      }
    }
  }
  return resumen;
};
