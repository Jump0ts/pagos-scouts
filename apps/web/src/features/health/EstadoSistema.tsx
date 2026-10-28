import { CircleAlert, CircleCheck, CircleHelp, Database, LoaderCircle, RefreshCw, Server } from "lucide-react";
import type { EstadoApi } from "./health.types";
import { useEstadoApi } from "./useEstadoApi";

type Situacion = "comprobando" | "bien" | "mal" | "desconocida";
type Fila = { nombre: string; icono: typeof Server; situacion: Situacion; detalle: string };

const filas = (estado: EstadoApi): Fila[] => {
  if (estado.fase === "cargando") {
    return [
      { nombre: "API", icono: Server, situacion: "comprobando", detalle: "Comprobando…" },
      { nombre: "Base de datos", icono: Database, situacion: "comprobando", detalle: "Comprobando…" },
    ];
  }
  if (estado.fase === "sin-api") {
    return [
      { nombre: "API", icono: Server, situacion: "mal", detalle: "No responde" },
      { nombre: "Base de datos", icono: Database, situacion: "desconocida", detalle: "Sin datos: la API no responde" },
    ];
  }
  return [
    { nombre: "API", icono: Server, situacion: "bien", detalle: `Responde (entorno ${estado.entorno})` },
    estado.fase === "ok"
      ? { nombre: "Base de datos", icono: Database, situacion: "bien", detalle: "Conectada" }
      : { nombre: "Base de datos", icono: Database, situacion: "mal", detalle: "La API no puede conectar" },
  ];
};

const IconoSituacion = ({ situacion }: { situacion: Situacion }) => {
  switch (situacion) {
    case "comprobando":
      return <LoaderCircle className="size-5 animate-spin text-suave" aria-label="Comprobando" />;
    case "bien":
      return <CircleCheck className="size-5 text-bosque" aria-label="Correcto" />;
    case "mal":
      return <CircleAlert className="size-5 text-rojo" aria-label="Con problemas" />;
    case "desconocida":
      return <CircleHelp className="size-5 text-suave" aria-label="Sin datos" />;
  }
};

export const EstadoSistema = () => {
  const { estado, comprobar } = useEstadoApi();
  const todoBien = estado.fase === "ok";

  return (
    <section aria-labelledby="estado-titulo" className="rounded-3xl bg-superficie p-5 ring-1 ring-linea md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="estado-titulo" className="font-display text-xl font-bold">Estado del sistema</h2>
          <p className="text-sm text-suave" aria-live="polite">
            {estado.fase === "cargando" ? "Comprobando…" : todoBien ? "Todo funciona." : "Hay algo que revisar."}
          </p>
        </div>
        <button
          type="button"
          onClick={comprobar}
          disabled={estado.fase === "cargando"}
          className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-linea transition-colors hover:bg-hundido disabled:opacity-50"
        >
          <RefreshCw className="size-4" aria-hidden /> Volver a comprobar
        </button>
      </div>

      <ul className="mt-4 divide-y divide-linea">
        {filas(estado).map(({ nombre, icono: Icono, situacion, detalle }) => (
          <li key={nombre} className="flex items-center gap-3 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hundido text-suave">
              <Icono className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{nombre}</span>
              <span className="text-sm text-suave">{detalle}</span>
            </span>
            <IconoSituacion situacion={situacion} />
          </li>
        ))}
      </ul>
    </section>
  );
};
