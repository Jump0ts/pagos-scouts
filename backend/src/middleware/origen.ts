import type { RequestHandler } from "express";
import { forbidden } from "../utils/errors.js";

const METODOS_SEGUROS = new Set(["GET", "HEAD", "OPTIONS"]);

// Proteccion CSRF. La cookie de sesion ya es SameSite=Lax, y ademas toda peticion que cambia datos debe venir de
// nuestra propia web: si el navegador manda Origin y no es este mismo dominio, se rechaza.
export const mismoOrigen: RequestHandler = (req, _res, next) => {
  if (METODOS_SEGUROS.has(req.method)) return next();

  const origen = req.get("origin");
  if (!origen) return next(); // herramientas sin navegador (curl, tests): no llevan cookies de un tercero

  let hostOrigen: string;
  try {
    hostOrigen = new URL(origen).host;
  } catch {
    return next(forbidden("Origen no válido"));
  }
  return hostOrigen === req.get("host") ? next() : next(forbidden("Origen no permitido"));
};
