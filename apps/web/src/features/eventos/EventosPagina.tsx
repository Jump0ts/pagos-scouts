import { CalendarDays, ChevronRight, Plus } from "lucide-react";
import { Link } from "react-router";
import { Aviso } from "@/components/Aviso";
import { BarraProgreso } from "@/components/BarraProgreso";
import { Cargando } from "@/components/Cargando";
import { usePerfil } from "@/features/auth/useSesion";
import { useSecciones } from "@/features/secciones/secciones.api";
import { FONDO_SECCION } from "@/features/secciones/secciones.constants";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { useEventos } from "./eventos.api";
import { ETIQUETA_TIPO } from "./eventos.constants";
import type { EventoConResumen } from "./eventos.types";

const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const hoy = () => new Date().toISOString().slice(0, 10);

const TarjetaEvento = ({ evento }: { evento: EventoConResumen }) => {
  const { data: secciones = [] } = useSecciones();
  const { resumen } = evento;
  const suyas = secciones.filter((s) => evento.precios.some((p) => p.seccionId === s.id));
  return (
    <Link
      to={`/eventos/${evento.id}`}
      className="flex flex-col gap-3 rounded-3xl bg-superficie p-4 ring-1 ring-linea transition hover:ring-bosque md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{evento.nombre}</p>
          <p className="text-sm text-suave">
            {ETIQUETA_TIPO[evento.tipo]} · hasta el {fechaCorta(evento.fechaFin)}
          </p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-suave" aria-hidden />
      </div>
      <BarraProgreso valor={resumen.pagadoCentimos} total={resumen.debidoCentimos} etiqueta={`Cobrado de ${evento.nombre}`} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="tabular-nums">
          <strong>{euros(resumen.pagadoCentimos)}</strong> <span className="text-suave">de {euros(resumen.debidoCentimos)}</span>
        </span>
        <span className="text-suave tabular-nums">
          {resumen.alDia}/{resumen.ninos} al día
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Secciones">
        {suyas.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-hundido px-2 py-0.5 text-xs font-semibold text-suave">
            <span className={cx("size-2 rounded-full", FONDO_SECCION[s.color])} aria-hidden /> {s.nombre}
          </span>
        ))}
      </div>
    </Link>
  );
};

// D-39: eventos activos con su barra de cobrado; los pasados, plegados.
export const EventosPagina = () => {
  const { grupoActivo } = usePerfil();
  const gestiona = grupoActivo?.rol === "ADMIN" || grupoActivo?.rol === "TESORERIA";
  const { data, isPending, error } = useEventos();

  if (isPending) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  const activos = data.eventos.filter((e) => e.fechaFin >= hoy());
  const pasados = data.eventos.filter((e) => e.fechaFin < hoy());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Eventos</h1>
          <p className="text-suave">{data.curso ? `Curso ${data.curso.nombre}` : "Todavía no hay ningún curso"}</p>
        </div>
        {gestiona && data.curso && (
          <Link to="/eventos/nuevo" className="inline-flex h-9 items-center gap-2 rounded-full bg-bosque px-3.5 text-sm font-semibold text-fondo">
            <Plus className="size-4" aria-hidden /> Nuevo evento
          </Link>
        )}
      </div>

      {data.eventos.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-linea p-10 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-hundido text-suave">
            <CalendarDays className="size-6" aria-hidden />
          </span>
          <h2 className="font-display text-xl font-bold">Aún no hay eventos</h2>
          <p className="max-w-md text-suave">
            {!data.curso
              ? "Primero carga el listado de educandos: los eventos se cobran a los niños de cada sección."
              : gestiona
                ? "Crea la cuota del curso, el censo o la próxima acampada para saber quién debe qué."
                : "Cuando tesorería cree los eventos, aquí verás quién ha pagado en tus secciones."}
          </p>
          {!data.curso && gestiona && (
            <Link to="/educandos/importar" className="mt-1 inline-flex h-12 items-center rounded-full bg-bosque px-5 text-sm font-semibold text-fondo">
              Importar listado
            </Link>
          )}
        </section>
      ) : (
        <>
          {activos.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {activos.map((e) => (
                <li key={e.id}>
                  <TarjetaEvento evento={e} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-3xl bg-superficie p-6 text-center text-suave ring-1 ring-linea">No hay eventos abiertos ahora mismo.</p>
          )}
          {pasados.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-bold tracking-[.12em] text-suave uppercase">
                Pasados ({pasados.length})
              </summary>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {pasados.map((e) => (
                  <li key={e.id}>
                    <TarjetaEvento evento={e} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
};
