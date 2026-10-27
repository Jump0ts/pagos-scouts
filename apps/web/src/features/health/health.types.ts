export type EstadoApi =
  | { fase: "cargando" }
  | { fase: "ok"; entorno: string }
  | { fase: "sin-base-de-datos"; entorno: string }
  | { fase: "sin-api" };

export type RespuestaHealth = {
  status: "ok" | "degradado";
  env: string;
  db: "ok" | "caida";
};
