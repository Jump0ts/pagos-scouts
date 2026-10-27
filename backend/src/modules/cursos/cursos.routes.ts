import { Router } from "express";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { nombreCursoPara } from "./cursos.utils.js";

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
