import { useCallback, useEffect, useState } from "react";
import type { EstadoApi, RespuestaHealth } from "./health.types";

const consultar = async (): Promise<EstadoApi> => {
  try {
    const res = await fetch("/api/health", { headers: { Accept: "application/json" } });
    // 503 también trae cuerpo: la API responde pero su base de datos no.
    if (!res.ok && res.status !== 503) return { fase: "sin-api" };
    const cuerpo = (await res.json()) as RespuestaHealth;
    return cuerpo.db === "ok" ? { fase: "ok", entorno: cuerpo.env } : { fase: "sin-base-de-datos", entorno: cuerpo.env };
  } catch {
    return { fase: "sin-api" };
  }
};

export const useEstadoApi = () => {
  const [estado, setEstado] = useState<EstadoApi>({ fase: "cargando" });

  const comprobar = useCallback(async () => {
    setEstado({ fase: "cargando" });
    setEstado(await consultar());
  }, []);

  useEffect(() => {
    let activo = true;
    consultar().then((resultado) => activo && setEstado(resultado));
    return () => {
      activo = false;
    };
  }, []);

  return { estado, comprobar };
};
