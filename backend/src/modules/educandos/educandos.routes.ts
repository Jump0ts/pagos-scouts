import type { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { cursoActivo, nombreCursoPara, obtenerOCrearCurso } from "../cursos/cursos.utils.js";
import { sincronizarCargos } from "../eventos/cargos.sincronizar.js";
import { familiaDelGrupo, nombreFamiliaPara } from "../familias/familias.utils.js";
import { comprobarSeccionesDelGrupo } from "../secciones/secciones.utils.js";
import { crearEducandoSchema, editarEducandoSchema } from "./educandos.schema.js";

export const educandosRouter = Router();
const gestion = requiereRol("ADMIN", "TESORERIA");

const educandoDelGrupo = async (id: string, grupoId: string) => {
  const educando = await prisma.educando.findFirst({ where: { id, grupoId } });
  if (!educando) throw notFound("Educando no encontrado");
  return educando;
};

const aFecha = (f: string | null | undefined) => (f === undefined ? undefined : f === null ? null : new Date(f));

// Familia existente (del grupo) o una nueva creada dentro de la transaccion.
const resolverFamilia = async (
  tx: Prisma.TransactionClient,
  grupoId: string,
  destino: z.infer<typeof crearEducandoSchema>["familia"],
  hijo: { nombre: string; apellidos: string },
) => {
  if ("id" in destino) return (await familiaDelGrupo(destino.id, grupoId)).id;
  const { responsables } = destino.nueva;
  const familia = await tx.familia.create({
    data: {
      grupoId,
      nombre: nombreFamiliaPara(hijo.apellidos, responsables, hijo.nombre),
      responsables: { create: responsables.map((nombreCompleto, orden) => ({ nombreCompleto, orden })) },
    },
  });
  return familia.id;
};

// Lista del curso activo. Un scouter solo ve sus secciones y no ve a que familia pertenece cada niño (D-32).
educandosRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const grupo = req.grupo!;
    const curso = await cursoActivo(grupo.id);
    if (!curso) {
      res.json({ curso: null, educandos: [] });
      return;
    }
    const esScouter = grupo.rol === "SCOUTER";
    const matriculas = await prisma.matricula.findMany({
      where: { cursoId: curso.id, bajaEn: null, ...(esScouter && { seccionId: { in: grupo.seccionIds } }) },
      orderBy: [{ educando: { nombre: "asc" } }, { educando: { apellidos: "asc" } }],
      select: {
        seccionId: true,
        educando: { select: { id: true, nombre: true, apellidos: true, familia: { select: { id: true, nombre: true } } } },
      },
    });
    res.json({
      curso: { id: curso.id, nombre: curso.nombre },
      educandos: matriculas.map(({ seccionId, educando: { familia, ...e } }) => ({
        ...e,
        seccionId,
        ...(esScouter ? {} : { familia }),
      })),
    });
  }),
);

educandosRouter.post(
  "/",
  gestion,
  asyncHandler(async (req, res) => {
    const datos = validar(crearEducandoSchema, req.body);
    const grupoId = req.grupo!.id;
    await comprobarSeccionesDelGrupo(grupoId, [datos.seccionId]);

    const educando = await prisma.$transaction(async (tx) => {
      const curso = (await cursoActivo(grupoId, tx)) ?? (await obtenerOCrearCurso(tx, grupoId, nombreCursoPara()));
      const familiaId = await resolverFamilia(tx, grupoId, datos.familia, datos);
      const creado = await tx.educando.create({
        data: {
          grupoId,
          familiaId,
          nombre: datos.nombre,
          apellidos: datos.apellidos,
          fechaNacimiento: aFecha(datos.fechaNacimiento),
          matriculas: { create: { cursoId: curso.id, seccionId: datos.seccionId } },
        },
        select: { id: true, familiaId: true },
      });
      // D-36: el niño nuevo recibe sus cargos de los eventos abiertos de su seccion.
      await sincronizarCargos(tx, grupoId);
      return creado;
    });
    res.status(201).json({ educando });
  }),
);

educandosRouter.patch(
  "/:id",
  gestion,
  asyncHandler(async (req, res) => {
    const datos = validar(editarEducandoSchema, req.body);
    const grupoId = req.grupo!.id;
    const actual = await educandoDelGrupo(req.params.id, grupoId);
    if (datos.seccionId) await comprobarSeccionesDelGrupo(grupoId, [datos.seccionId]);

    await prisma.$transaction(async (tx) => {
      const familiaId = datos.familia
        ? await resolverFamilia(tx, grupoId, datos.familia, {
            nombre: datos.nombre ?? actual.nombre,
            apellidos: datos.apellidos ?? actual.apellidos,
          })
        : undefined;
      await tx.educando.update({
        where: { id: actual.id },
        data: { nombre: datos.nombre, apellidos: datos.apellidos, fechaNacimiento: aFecha(datos.fechaNacimiento), familiaId },
      });
      if (datos.seccionId) {
        const curso = (await cursoActivo(grupoId, tx)) ?? (await obtenerOCrearCurso(tx, grupoId, nombreCursoPara()));
        await tx.matricula.upsert({
          where: { educandoId_cursoId: { educandoId: actual.id, cursoId: curso.id } },
          create: { educandoId: actual.id, cursoId: curso.id, seccionId: datos.seccionId },
          update: { seccionId: datos.seccionId },
        });
      }
      // Si la familia anterior se queda sin hijos, sobra.
      if (familiaId && familiaId !== actual.familiaId) {
        const quedan = await tx.educando.count({ where: { familiaId: actual.familiaId } });
        if (quedan === 0) await tx.familia.delete({ where: { id: actual.familiaId } });
      }
      await sincronizarCargos(tx, grupoId);
    });
    res.json({ educando: await prisma.educando.findUniqueOrThrow({ where: { id: actual.id }, select: { id: true, familiaId: true } }) });
  }),
);

// D-30: la baja conserva el historial; se puede deshacer.
const cambiarBaja = (baja: boolean) =>
  asyncHandler(async (req, res) => {
    const grupoId = req.grupo!.id;
    const educando = await educandoDelGrupo(req.params.id, grupoId);
    const curso = await cursoActivo(grupoId);
    if (!curso) throw badRequest("Todavía no hay ningún curso");
    const { count } = await prisma.matricula.updateMany({
      where: { educandoId: educando.id, cursoId: curso.id },
      data: { bajaEn: baja ? new Date() : null },
    });
    if (count === 0) throw conflict("No está matriculado en el curso actual");
    await sincronizarCargos(prisma, grupoId);
    res.status(204).end();
  });

educandosRouter.post("/:id/baja", gestion, cambiarBaja(true));
educandosRouter.delete("/:id/baja", gestion, cambiarBaja(false));

// D-30: borrado definitivo, solo administradores, y nunca si tiene algun pago registrado.
educandosRouter.delete(
  "/:id",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const educando = await educandoDelGrupo(req.params.id, req.grupo!.id);
    if (await prisma.asignacion.count({ where: { cargo: { educandoId: educando.id } } })) {
      throw conflict("Tiene pagos registrados. Puedes darle de baja; su historial se conserva.");
    }
    await prisma.$transaction(async (tx) => {
      await tx.educando.delete({ where: { id: educando.id } });
      const quedan = await tx.educando.count({ where: { familiaId: educando.familiaId } });
      if (quedan === 0) await tx.familia.delete({ where: { id: educando.familiaId } });
      await sincronizarCargos(tx, educando.grupoId);
    });
    res.status(204).end();
  }),
);
