import { Router } from "express";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, conflict } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { cursoSiguiente, edadEnCurso, proponerSeccion } from "./cursos.paso.js";
import { pasoCursoSchema } from "./cursos.schema.js";
import { cursoActivo, nombreCursoPara } from "./cursos.utils.js";

export const cursosRouter = Router();

cursosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const cursos = await prisma.curso.findMany({
      where: { grupoId: req.grupo!.id },
      orderBy: { nombre: "desc" },
      select: { id: true, nombre: true, activo: true },
    });
    res.json({ cursos, sugerido: nombreCursoPara() });
  }),
);

// Los niños que siguen en el curso activo, con su seccion y su fecha de nacimiento.
const matriculasActivas = (cursoId: string, grupoId: string) =>
  prisma.matricula.findMany({
    where: { cursoId, bajaEn: null, educando: { grupoId } },
    orderBy: [{ educando: { nombre: "asc" } }, { educando: { apellidos: "asc" } }],
    select: {
      seccionId: true,
      educando: { select: { id: true, nombre: true, apellidos: true, fechaNacimiento: true } },
    },
  });

const seccionesDelGrupo = (grupoId: string) =>
  prisma.seccion.findMany({
    where: { grupoId },
    orderBy: { orden: "asc" },
    select: { id: true, nombre: true, orden: true, color: true, edadMaxima: true, archivada: true },
  });

const sinCursoActivo = () => conflict("Todavía no hay ningún curso: importa el listado o da de alta a algún niño primero");

// D-79 a D-81, D-84: la propuesta del paso de curso. Nada se guarda hasta confirmar.
cursosRouter.get(
  "/paso",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const grupoId = req.grupo!.id;
    const origen = await cursoActivo(grupoId);
    if (!origen) throw sinCursoActivo();
    const destino = cursoSiguiente(origen.nombre);
    const [secciones, matriculas, yaExiste] = await Promise.all([
      seccionesDelGrupo(grupoId),
      matriculasActivas(origen.id, grupoId),
      prisma.curso.findUnique({ where: { grupoId_nombre: { grupoId, nombre: destino } }, select: { id: true } }),
    ]);
    res.json({
      origen: { id: origen.id, nombre: origen.nombre },
      destino,
      destinoExiste: Boolean(yaExiste),
      secciones,
      filas: matriculas.map(({ seccionId, educando }) => {
        const edad = edadEnCurso(educando.fechaNacimiento, destino);
        return {
          educandoId: educando.id,
          nombre: educando.nombre,
          apellidos: educando.apellidos,
          seccionActualId: seccionId,
          edad,
          propuesta: proponerSeccion(secciones, seccionId, edad),
        };
      }),
    });
  }),
);

cursosRouter.post(
  "/paso",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const { origenId, filas } = validar(pasoCursoSchema, req.body);
    const grupoId = req.grupo!.id;

    const curso = await prisma.$transaction(async (tx) => {
      const origen = await cursoActivo(grupoId, tx);
      if (!origen) throw sinCursoActivo();
      if (origen.id !== origenId) throw conflict("El curso ya ha cambiado: vuelve a abrir el paso de curso");
      const destino = cursoSiguiente(origen.nombre);
      if (await tx.curso.findUnique({ where: { grupoId_nombre: { grupoId, nombre: destino } } })) {
        throw conflict(`El curso ${destino} ya existe`);
      }

      // Exactamente los niños del curso activo, cada uno una vez.
      const matriculas = await tx.matricula.findMany({
        where: { cursoId: origen.id, bajaEn: null, educando: { grupoId } },
        select: { educandoId: true, seccionId: true },
      });
      const actualDe = new Map(matriculas.map((m) => [m.educandoId, m.seccionId]));
      const ids = filas.map((f) => f.educandoId);
      if (new Set(ids).size !== ids.length || ids.length !== actualDe.size || ids.some((id) => !actualDe.has(id))) {
        throw badRequest("La lista no coincide con los niños del curso: vuelve a abrir el paso de curso");
      }

      // Secciones del grupo; una archivada solo vale para quien ya estaba en ella.
      const secciones = await tx.seccion.findMany({ where: { grupoId }, select: { id: true, archivada: true } });
      const archivada = new Map(secciones.map((s) => [s.id, s.archivada]));
      for (const f of filas) {
        if (f.seccionId === null) continue;
        if (!archivada.has(f.seccionId) || (archivada.get(f.seccionId) && f.seccionId !== actualDe.get(f.educandoId))) {
          throw badRequest("Alguna sección no es válida", { filas: "Sección no válida" });
        }
      }

      const nuevo = await tx.curso.create({ data: { grupoId, nombre: destino, activo: false } });
      await tx.matricula.createMany({
        data: filas.flatMap((f) => (f.seccionId ? [{ educandoId: f.educandoId, cursoId: nuevo.id, seccionId: f.seccionId }] : [])),
      });
      await tx.curso.update({ where: { id: origen.id }, data: { activo: false } });
      return tx.curso.update({ where: { id: nuevo.id }, data: { activo: true }, select: { id: true, nombre: true, activo: true } });
    });

    const siguen = filas.filter((f) => f.seccionId !== null).length;
    res.status(201).json({ curso, siguen, terminan: filas.length - siguen });
  }),
);
