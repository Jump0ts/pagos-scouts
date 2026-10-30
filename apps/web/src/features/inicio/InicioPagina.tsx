import { ChevronRight, Inbox } from "lucide-react";
import { Link } from "react-router";
import { ETIQUETA_ROL } from "@/features/auth/auth.constants";
import { usePerfil } from "@/features/auth/useSesion";
import { useEventos } from "@/features/eventos/eventos.api";
import { enSeguimiento } from "@/features/eventos/eventos.utils";
import { TarjetaEvento } from "@/features/eventos/TarjetaEvento";
import { EstadoSistema } from "@/features/health/EstadoSistema";
import { useMovimientos } from "@/features/movimientos/movimientos.api";
import { TarjetaInstalar } from "@/features/pwa/TarjetaInstalar";

// Los pagos que esperan una decisión (D-5). Solo para quien ve los movimientos del banco (D-16).
const TarjetaDudas = () => {
  const { data } = useMovimientos("DUDA");
  if (!data) return null;
  const dudas = data.contadores.dudas;
  return (
    <Link
      to="/movimientos"
      className="flex items-center gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea transition hover:ring-bosque md:p-6"
    >
      <span className={dudas ? "grid size-12 shrink-0 place-items-center rounded-2xl bg-ambar-claro text-tinta" : "grid size-12 shrink-0 place-items-center rounded-2xl bg-bosque-claro text-bosque"}>
        <Inbox className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-bold">
          {dudas ? `${dudas} ${dudas === 1 ? "duda" : "dudas"} por resolver` : "Sin dudas"}
        </span>
        <span className="text-sm text-suave">
          {dudas ? "Pagos del banco que necesitan tu decisión." : "Todo lo importado del banco está clasificado."}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-suave" aria-hidden />
    </Link>
  );
};

// D-57: los eventos abiertos o con algo pendiente; un scouter, los de sus secciones con lo cobrado en ellas.
const EventosEnCurso = () => {
  const { data } = useEventos();
  const eventos = (data?.eventos ?? []).filter(enSeguimiento);
  if (!eventos.length) return null;
  return (
    <section aria-labelledby="inicio-eventos" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="inicio-eventos" className="text-xs font-bold tracking-[.12em] text-suave uppercase">
          Eventos en marcha
        </h2>
        <Link to="/eventos" className="text-sm font-semibold text-bosque hover:underline">
          Ver todos
        </Link>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {eventos.map((e) => (
          <li key={e.id}>
            <TarjetaEvento evento={e} />
          </li>
        ))}
      </ul>
    </section>
  );
};

export const InicioPagina = () => {
  const { usuario, grupoActivo } = usePerfil();
  const nombrePila = usuario.nombre.split(/\s+/)[0];
  const gestiona = grupoActivo?.rol === "ADMIN" || grupoActivo?.rol === "TESORERIA";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance">Hola, {nombrePila}</h1>
        {grupoActivo && (
          <p className="mt-1 text-suave">
            {grupoActivo.nombre} · {ETIQUETA_ROL[grupoActivo.rol]}
          </p>
        )}
      </div>

      <TarjetaInstalar />

      {gestiona && <TarjetaDudas />}

      <EventosEnCurso />

      <EstadoSistema />
    </div>
  );
};
