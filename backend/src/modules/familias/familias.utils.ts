import { prisma } from "../../prisma.js";
import { notFound } from "../../utils/errors.js";

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
        },
      },
    },
  });
  if (!familia) throw notFound("Familia no encontrada");
  return {
    id: familia.id,
    nombre: familia.nombre,
    responsables: familia.responsables,
    educandos: familia.educandos.map(({ matriculas, ...e }) => ({
      ...e,
      seccionId: matriculas[0]?.seccionId ?? null,
      deBaja: Boolean(matriculas[0]?.bajaEn),
    })),
  };
};
