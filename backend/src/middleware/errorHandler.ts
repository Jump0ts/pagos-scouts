import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError, notFound } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound("Ruta no encontrada"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.campos ? { error: err.message, campos: err.campos } : { error: err.message });
    return;
  }
  // JSON mal formado en el cuerpo de la peticion.
  if (err instanceof SyntaxError && "status" in err && err.status === 400) {
    res.status(400).json({ error: "El cuerpo de la petición no es JSON válido" });
    return;
  }
  // Cualquier otro error es un fallo nuestro: se registra, pero al cliente no se le dan detalles.
  console.error(err);
  res.status(500).json({ error: "Error interno" });
};
