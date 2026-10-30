import { prisma } from "../../prisma.js";
import { notFound } from "../../utils/errors.js";
import { estadoDe, importeDe } from "../eventos/cargos.utils.js";
import { saldoDe } from "../movimientos/reparto.js";

const MAX_PAGOS_FICHA = 50;

// "Familia Gil Ferrer" a partir de los apellidos de un hijo; si no los hay, del primer responsable o del niño.
export const nombreFamiliaPara = (apellidosHijo: string, responsables: string[], nombreHijo: string) => {
  if (apellidosHijo.trim()) return `Familia ${apellidosHijo.trim()}`;
  const responsable = responsables[0]?.trim();
  if (responsable) return `Familia de ${responsable}`;
  return `Familia de ${nombreHijo.trim()}`;
};

export const familiaDelGrupo = async (familiaId: string, grupoId: string) => {
  const familia = await prisma.familia.findFirst({ where: { id: familiaId, grupoId } });
  if (!familia) throw notFound("Familia no encontrada");
  return familia;
};

export const fichaFamilia = async (familiaId: string, grupoId: string, cursoId: string | null) => {
  const familia = await prisma.familia.findFirst({
    where: { id: familiaId, grupoId },
    select: {
      id: true,
      nombre: true,
      responsables: { orderBy: { orden: "asc" }, select: { id: true, nombreCompleto: true } },
      educandos: {
        orderBy: [{ nombre: "asc" }],
        select: {
          id: true,
          nombre: true,
          apellidos: true,
          fechaNacimiento: true,
          matriculas: {
            // Sin curso todavia no hay matricula que mostrar ("" no coincide con ningun curso).
            where: { cursoId: cursoId ?? "" },
            select: { seccionId: true, bajaEn: true },
          },
          // D-41: lo que debe y lo que ha pagado en los eventos del curso activo; D-82: y lo que quede pendiente de
          // cursos anteriores, que tambien se puede cobrar.
          cargos: {
            where: { estado: "ACTIVO" },
            orderBy: { evento: { fechaInicio: "asc" } },
            select: {
              id: true,
              importeCalculadoCentimos: true,
              importeAjustadoCentimos: true,
              evento: { select: { id: true, nombre: true, cursoId: true, curso: { select: { nombre: true } } } },
              asignaciones: { select: { importeCentimos: true } },
            },
          },
        },
      },
    },
  });
  if (!familia) throw notFound("Familia no encontrada");
  const pagos = await prisma.movimiento.findMany({
    where: { grupoId, familiaId, estado: "CLASIFICADO" },
    orderBy: [{ fecha: { sort: "desc", nulls: "last" } }, { creadoEn: "desc" }],
    take: MAX_PAGOS_FICHA,
    select: { id: true, origen: true, medio: true, fecha: true, concepto: true, importeCentimos: true },
  });
  const [saldoCentimos, pagadores] = await Promise.all([
    saldoDe(prisma, familiaId),
    prisma.pagador.findMany({ where: { familiaId }, orderBy: { creadoEn: "asc" }, select: { id: true, nombre: true } }),
  ]);
  return {
    id: familia.id,
    nombre: familia.nombre,
    responsables: familia.responsables,
    educandos: familia.educandos.map(({ matriculas, cargos, ...e }) => ({
      ...e,
      seccionId: matriculas[0]?.seccionId ?? null,
      deBaja: Boolean(matriculas[0]?.bajaEn),
      cargos: cargos.flatMap((c) => {
        const pagado = c.asignaciones.reduce((n, a) => n + a.importeCentimos, 0);
        const deOtroCurso = c.evento.cursoId !== cursoId;
        // De otros cursos, solo lo que sigue pendiente o a medias.
        if (deOtroCurso && pagado >= importeDe(c)) return [];
        return [
          {
            id: c.id,
            evento: { id: c.evento.id, nombre: c.evento.nombre },
            cursoAnterior: deOtroCurso ? c.evento.curso.nombre : null,
            importeCentimos: importeDe(c),
            pagadoCentimos: pagado,
            estado: estadoDe(importeDe(c), pagado),
          },
        ];
      }),
    })),
    pagos: pagos.map((p) => ({ ...p, fecha: p.fecha?.toISOString().slice(0, 10) ?? null })),
    // D-48 y D-1: saldo a favor y nombres de quien paga aprendidos para esta familia.
    saldoCentimos,
    pagadores,
  };
};
