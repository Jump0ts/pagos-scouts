import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, notFound } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound("Ruta no encontrada"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Cualquier otro error es un fallo nuestro: se registra, pero al cliente no se le dan detalles.
  console.error(err);
  res.status(500).json({ error: "Error interno" });
};
