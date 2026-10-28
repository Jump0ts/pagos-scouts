import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 no captura errores de funciones async: este envoltorio los pasa al errorHandler.
export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };
