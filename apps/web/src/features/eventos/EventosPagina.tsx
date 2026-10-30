import { CalendarDays, Plus, Shirt } from "lucide-react";
import { Link } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { usePerfil } from "@/features/auth/useSesion";
import { mensajeDeError } from "@/utils/api";
import { useEventos } from "./eventos.api";
import { hoy } from "./eventos.utils";
import { TarjetaEvento } from "./TarjetaEvento";

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
          <div className="flex flex-wrap gap-2">
            <Link
              to="/eventos/pedidos/nuevo"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-superficie px-3.5 text-sm font-semibold ring-1 ring-linea hover:bg-hundido"
            >
              <Shirt className="size-4" aria-hidden /> Nuevo pedido
            </Link>
            <Link to="/eventos/nuevo" className="inline-flex h-9 items-center gap-2 rounded-full bg-bosque px-3.5 text-sm font-semibold text-fondo">
              <Plus className="size-4" aria-hidden /> Nuevo evento
            </Link>
          </div>
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
