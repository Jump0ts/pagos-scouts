import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { cargarSesion, requiereGrupo, requiereRol, requiereSesion } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { mismoOrigen } from "./middleware/origen.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { cursosRouter } from "./modules/cursos/cursos.routes.js";
import { educandosRouter } from "./modules/educandos/educandos.routes.js";
import { eventosRouter } from "./modules/eventos/eventos.routes.js";
import { familiasRouter } from "./modules/familias/familias.routes.js";
import { importacionesRouter } from "./modules/importaciones/importaciones.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { invitacionesRouter } from "./modules/invitaciones/invitaciones.routes.js";
import { restablecerRouter } from "./modules/restablecer/restablecer.routes.js";
import { seccionesRouter } from "./modules/secciones/secciones.routes.js";
import { usuariosRouter } from "./modules/usuarios/usuarios.routes.js";

export const createApp = () => {
  const app = express();

  // Detras del nginx de la web y del nginx del servidor (D-12): la IP real llega en X-Forwarded-For.
  app.set("trust proxy", 2);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);

  app.use("/api", mismoOrigen, cargarSesion);
  app.use("/api/auth", authRouter);
  app.use("/api/invitaciones", invitacionesRouter);
  app.use("/api/restablecer", restablecerRouter);
  app.use("/api/secciones", requiereSesion, requiereGrupo, seccionesRouter);
  app.use("/api/cursos", requiereSesion, requiereGrupo, cursosRouter);
  app.use("/api/educandos", requiereSesion, requiereGrupo, educandosRouter);
  app.use("/api/familias", requiereSesion, requiereGrupo, familiasRouter);
  app.use("/api/eventos", requiereSesion, requiereGrupo, eventosRouter);
  app.use("/api/importaciones", requiereSesion, requiereGrupo, importacionesRouter);
  app.use("/api/usuarios", requiereSesion, requiereGrupo, requiereRol("ADMIN"), usuariosRouter);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
};
