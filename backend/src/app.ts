import express from "express";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./modules/health/health.routes.js";

export const createApp = () => {
  const app = express();

  // Detras del nginx de la web y del nginx del servidor (D-12): la IP real llega en X-Forwarded-For.
  app.set("trust proxy", 2);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/health", healthRouter);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
};
