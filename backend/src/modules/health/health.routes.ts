import { Router } from "express";
import { env } from "../../env.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const healthRouter = Router();

// Lo usan el healthcheck del contenedor, la CI y la web para saber si la API y su base de datos responden.
healthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const db = await prisma.$queryRaw`SELECT 1`.then(
      () => "ok" as const,
      () => "caida" as const,
    );
    res.status(db === "ok" ? 200 : 503).json({ status: db === "ok" ? "ok" : "degradado", env: env.NODE_ENV, db });
  }),
);
