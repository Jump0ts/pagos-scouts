import { Prisma } from "@prisma/client";
import { Router } from "express";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { crearSeccionSchema, editarSeccionSchema, ordenSeccionesSchema } from "./secciones.schema.js";

export const seccionesRouter = Router();

const seleccion = { id: true, nombre: true, orden: true, color: true, archivada: true } as const;

const nombreRepetido = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return conflict("Ya hay una sección con ese nombre");
  }
  return error;
};

// Cualquier miembro del grupo puede verlas (la web las necesita para pintar filtros y etiquetas).
seccionesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const secciones = await prisma.seccion.findMany({
      where: { grupoId: req.grupo!.id },
      orderBy: { orden: "asc" },
      select: seleccion,
    });
    res.json({ secciones });
  }),
);

seccionesRouter.post(
  "/",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const datos = validar(crearSeccionSchema, req.body);
    const grupoId = req.grupo!.id;
    const ultima = await prisma.seccion.aggregate({ where: { grupoId }, _max: { orden: true } });
    const seccion = await prisma.seccion
      .create({ data: { ...datos, grupoId, orden: (ultima._max.orden ?? -1) + 1 }, select: seleccion })
      .catch((error) => Promise.reject(nombreRepetido(error)));
    res.status(201).json({ seccion });
  }),
);

seccionesRouter.put(
  "/orden",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const { ids } = validar(ordenSeccionesSchema, req.body);
    const grupoId = req.grupo!.id;
    const actuales = await prisma.seccion.findMany({ where: { grupoId }, select: { id: true } });
    const mismas = ids.length === actuales.length && new Set(ids).size === ids.length && actuales.every((s) => ids.includes(s.id));
    if (!mismas) throw badRequest("El orden debe incluir todas las secciones del grupo, una vez cada una");

    await prisma.$transaction(ids.map((id, orden) => prisma.seccion.update({ where: { id }, data: { orden } })));
    const secciones = await prisma.seccion.findMany({ where: { grupoId }, orderBy: { orden: "asc" }, select: seleccion });
    res.json({ secciones });
  }),
);

seccionesRouter.patch(
  "/:id",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const datos = validar(editarSeccionSchema, req.body);
    // updateMany con el grupo en el filtro: una seccion de otro grupo es, a todos los efectos, inexistente.
    const { count } = await prisma.seccion
      .updateMany({ where: { id: req.params.id, grupoId: req.grupo!.id }, data: datos })
      .catch((error) => Promise.reject(nombreRepetido(error)));
    if (count === 0) throw notFound("Sección no encontrada");

    const seccion = await prisma.seccion.findUniqueOrThrow({ where: { id: req.params.id }, select: seleccion });
    res.json({ seccion });
  }),
);
