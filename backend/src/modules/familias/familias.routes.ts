import { Router } from "express";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { conflict, notFound } from "../../utils/errors.js";
import { aplicarSaldoSchema } from "../movimientos/movimientos.schema.js";
import { aplicarSaldo } from "../movimientos/reparto.js";
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

// D-48: aplicar el saldo a favor de la familia a una de sus deudas.
familiasRouter.post(
  "/:id/saldo/aplicar",
  asyncHandler(async (req, res) => {
    const { cargoId } = validar(aplicarSaldoSchema, req.body);
    const familia = await familiaDelGrupo(req.params.id, req.grupo!.id);
    const aplicado = await prisma.$transaction((tx) => aplicarSaldo(tx, familia.id, cargoId));
    res.json({ aplicadoCentimos: aplicado });
  }),
);

// D-1: olvidar un pagador aprendido; sus pagos ya clasificados no cambian.
familiasRouter.delete(
  "/:id/pagadores/:pagadorId",
  asyncHandler(async (req, res) => {
    const familia = await familiaDelGrupo(req.params.id, req.grupo!.id);
    const { count } = await prisma.pagador.deleteMany({ where: { id: req.params.pagadorId, familiaId: familia.id } });
    if (!count) throw notFound("Pagador no encontrado");
    res.status(204).end();
  }),
);

// D-30: borrado definitivo de una familia con todos sus niños. Solo administradores, y nunca si tiene pagos.
familiasRouter.delete(
  "/:id",
  requiereRol("ADMIN"),
  asyncHandler(async (req, res) => {
    const familia = await familiaDelGrupo(req.params.id, req.grupo!.id);
    const conPagos = await Promise.all([
      prisma.asignacion.count({ where: { cargo: { educando: { familiaId: familia.id } } } }),
      // Un pago sin repartir tambien cuenta: es saldo de la familia (D-48).
      prisma.movimiento.count({ where: { familiaId: familia.id, estado: "CLASIFICADO" } }),
    ]);
    if (conPagos.some(Boolean)) {
      throw conflict("Esta familia tiene pagos registrados. Puedes dar de baja a sus niños; su historial se conserva.");
    }
    await prisma.familia.delete({ where: { id: familia.id } });
    res.status(204).end();
  }),
);
