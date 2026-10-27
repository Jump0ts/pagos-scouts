import { Router } from "express";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validar } from "../../utils/validar.js";
import { cursoActivo } from "../cursos/cursos.utils.js";
import { editarFamiliaSchema } from "./familias.schema.js";
import { familiaDelGrupo, fichaFamilia } from "./familias.utils.js";

// D-32: la ficha de familia es para Admin y Tesoreria; un scouter no la abre.
export const familiasRouter = Router();
familiasRouter.use(requiereRol("ADMIN", "TESORERIA"));

familiasRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const curso = await cursoActivo(req.grupo!.id);
    res.json({ familia: await fichaFamilia(req.params.id, req.grupo!.id, curso?.id ?? null) });
  }),
);

familiasRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { nombre, responsables } = validar(editarFamiliaSchema, req.body);
    const familia = await familiaDelGrupo(req.params.id, req.grupo!.id);
    await prisma.familia.update({
      where: { id: familia.id },
      data: {
        nombre,
        ...(responsables && {
          responsables: { deleteMany: {}, create: responsables.map((nombreCompleto, orden) => ({ nombreCompleto, orden })) },
        }),
      },
    });
    const curso = await cursoActivo(req.grupo!.id);
    res.json({ familia: await fichaFamilia(familia.id, req.grupo!.id, curso?.id ?? null) });
  }),
);

// D-30: borrado definitivo de una familia con todos sus niños. Solo administradores.
// Cuando existan los pagos (parte 4) se impedira si la familia tiene alguno registrado.
familiasRouter.delete(
  "/:id",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const familia = await familiaDelGrupo(req.params.id, req.grupo!.id);
    await prisma.familia.delete({ where: { id: familia.id } });
    res.status(204).end();
  }),
);
