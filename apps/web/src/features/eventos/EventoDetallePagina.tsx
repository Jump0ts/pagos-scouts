import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, Ellipsis, Pencil, Plus, Trash2, UserMinus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { BarraProgreso } from "@/components/BarraProgreso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { Confirmar } from "@/components/Confirmar";
import { usePerfil } from "@/features/auth/useSesion";
import { useSecciones } from "@/features/secciones/secciones.api";
import { FONDO_SECCION } from "@/features/secciones/secciones.constants";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { AjustarCargoDialogo } from "./AjustarCargoDialogo";
import { AnadirNinosDialogo } from "./AnadirNinosDialogo";
import { useBorrarEvento, useEvento, useQuitarCargo } from "./eventos.api";
import { ESTADOS, ETIQUETA_TIPO } from "./eventos.constants";
import type { CargoVista, EstadoCargo } from "./eventos.types";

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
const claseItem = "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hundido";

const FILTROS: { valor: EstadoCargo | null; etiqueta: string }[] = [
  { valor: null, etiqueta: "Todos" },
  { valor: "PENDIENTE", etiqueta: "Pendientes" },
  { valor: "PARCIAL", etiqueta: "A medias" },
  { valor: "PAGADO", etiqueta: "Pagados" },
  { valor: "EXENTO", etiqueta: "Exentos" },
];

// D-39: resumen, filtros por estado y sección, y los niños agrupados por sección con su estado.
export const EventoDetallePagina = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const { grupoActivo } = usePerfil();
  const gestiona = grupoActivo?.rol === "ADMIN" || grupoActivo?.rol === "TESORERIA";
  const esAdmin = grupoActivo?.rol === "ADMIN";
  const { data, isPending, error } = useEvento(id);
  const { data: secciones = [] } = useSecciones();
  const quitar = useQuitarCargo();
  const borrar = useBorrarEvento();

  const [estado, setEstado] = useState<EstadoCargo | null>(null);
  const [seccion, setSeccion] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState<CargoVista | null>(null);
  const [quitando, setQuitando] = useState<CargoVista | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const visibles = useMemo(
    () => (data?.cargos ?? []).filter((c) => (!estado || c.estado === estado) && (!seccion || c.seccionId === seccion)),
    [data, estado, seccion],
  );

  if (isPending) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  const { evento, resumen } = data;
  const delEvento = secciones.filter((s) => evento.precios.some((p) => p.seccionId === s.id));
  const grupos = delEvento.map((s) => ({ seccion: s, cargos: visibles.filter((c) => c.seccionId === s.id) })).filter((g) => g.cargos.length);
  const pendiente = resumen.debidoCentimos - resumen.pagadoCentimos;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link to="/eventos" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> Eventos
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-balance">{evento.nombre}</h1>
            <p className="text-suave">
              {ETIQUETA_TIPO[evento.tipo]} · del {fechaLarga(evento.fechaInicio)} al {fechaLarga(evento.fechaFin)}
              {evento.descuentoHermanos && evento.precioSegundoCentimos !== null && (
                <> · hermanos {euros(evento.precioSegundoCentimos)}{evento.precioTerceroCentimos !== null && ` / ${euros(evento.precioTerceroCentimos)}`}</>
              )}
            </p>
          </div>
          {gestiona && (
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" tamano="pequeno" onClick={() => setAnadiendo(true)}>
                <Plus className="size-4" aria-hidden /> Añadir niños
              </Boton>
              <Link
                to={`/eventos/${evento.id}/editar`}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-superficie px-3.5 text-sm font-semibold ring-1 ring-linea hover:bg-hundido"
              >
                <Pencil className="size-4" aria-hidden /> Editar
              </Link>
              {esAdmin && (
                <Boton variante="fantasma" tamano="pequeno" className="text-rojo" onClick={() => setBorrando(true)} aria-label="Borrar evento">
                  <Trash2 className="size-4" aria-hidden />
                </Boton>
              )}
            </div>
          )}
        </div>
      </div>

      {aviso && <Aviso tono="exito">{aviso}</Aviso>}

      <section aria-label="Resumen" className="flex flex-col gap-3 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { etiqueta: "Debido", valor: euros(resumen.debidoCentimos) },
            { etiqueta: "Cobrado", valor: euros(resumen.pagadoCentimos) },
            { etiqueta: "Pendiente", valor: euros(pendiente) },
            { etiqueta: "Al día", valor: `${resumen.alDia} de ${resumen.ninos}` },
          ].map((d) => (
            <div key={d.etiqueta}>
              <dt className="text-xs font-semibold text-suave">{d.etiqueta}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{d.valor}</dd>
            </div>
          ))}
        </dl>
        <BarraProgreso valor={resumen.pagadoCentimos} total={resumen.debidoCentimos} etiqueta="Cobrado del evento" />
        {resumen.pagadoCentimos === 0 && resumen.debidoCentimos > 0 && (
          <p className="text-sm text-suave">Los pagos se cruzarán con el Excel del banco cuando llegue esa parte.</p>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <div role="group" aria-label="Filtrar por estado" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTROS.map((f) => (
            <button
              key={f.etiqueta}
              type="button"
              aria-pressed={estado === f.valor}
              onClick={() => setEstado(f.valor)}
              className={cx(
                "h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                estado === f.valor ? "bg-tinta text-fondo ring-tinta" : "bg-superficie text-suave ring-linea hover:text-tinta",
              )}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
        {delEvento.length > 1 && (
          <div role="group" aria-label="Filtrar por sección" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {[{ id: null, nombre: "Todas", color: null }, ...delEvento].map((s) => (
              <button
                key={s.id ?? "todas"}
                type="button"
                aria-pressed={seccion === s.id}
                onClick={() => setSeccion(s.id)}
                className={cx(
                  "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                  seccion === s.id ? "bg-tinta text-fondo ring-tinta" : "bg-superficie text-suave ring-linea hover:text-tinta",
                )}
              >
                {s.color && <span className={cx("size-2.5 rounded-full", FONDO_SECCION[s.color])} aria-hidden />}
                {s.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {grupos.length === 0 && (
        <p className="rounded-3xl bg-superficie p-6 text-center text-suave ring-1 ring-linea">
          {data.cargos.length === 0
            ? evento.tipo === "CON_APUNTADOS"
              ? "Todavía no hay nadie apuntado."
              : "No hay niños en las secciones de este evento."
            : "Nadie con ese filtro."}
        </p>
      )}

      {grupos.map(({ seccion: s, cargos }) => (
        <section key={s.id} aria-labelledby={`ev-seccion-${s.id}`} className="flex flex-col gap-2">
          <h2 id={`ev-seccion-${s.id}`} className="flex items-center gap-2 text-xs font-bold tracking-[.12em] text-suave uppercase">
            <span className={cx("size-2.5 rounded-full", FONDO_SECCION[s.color])} aria-hidden />
            {s.nombre} · {cargos.length}
          </h2>
          <ul className="divide-y divide-linea overflow-hidden rounded-3xl bg-superficie ring-1 ring-linea">
            {cargos.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5 pr-2 pl-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="font-semibold">{c.educando.nombre}</span> <span className="text-suave">{c.educando.apellidos}</span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-suave">
                    {evento.descuentoHermanos && c.posicionHermano > 1 && <span>{c.posicionHermano}º hermano</span>}
                    {c.ajustado && <span title={c.motivoAjuste ?? undefined}>Ajustado{c.motivoAjuste ? `: ${c.motivoAjuste}` : ""}</span>}
                  </span>
                </span>
                <span className="text-right text-sm tabular-nums">
                  <span className="block font-semibold">{euros(c.importeCentimos)}</span>
                  {c.pagadoCentimos > 0 && c.estado === "PARCIAL" && <span className="text-xs text-suave">{euros(c.pagadoCentimos)} pagado</span>}
                </span>
                <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", ESTADOS[c.estado].clase)}>
                  {ESTADOS[c.estado].etiqueta}
                </span>
                {gestiona && (
                  <Menu.Root>
                    <Menu.Trigger
                      aria-label={`Acciones para ${c.educando.nombre}`}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
                    >
                      <Ellipsis className="size-5" aria-hidden />
                    </Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-2xl bg-superficie p-1.5 shadow-xl ring-1 ring-linea">
                        <Menu.Item className={claseItem} onSelect={() => setAjustando(c)}>
                          <Pencil className="size-4 text-suave" aria-hidden /> Ajustar importe
                        </Menu.Item>
                        <Menu.Item className={`${claseItem} text-rojo`} onSelect={() => setQuitando(c)}>
                          <UserMinus className="size-4" aria-hidden /> Quitar del evento
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Portal>
                  </Menu.Root>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {data.excluidos > 0 && gestiona && (
        <p className="text-sm text-suave">
          {data.excluidos} {data.excluidos === 1 ? "niño quitado" : "niños quitados"} a mano de este evento. Puedes volver a añadirlos con «Añadir niños».
        </p>
      )}

      {gestiona && (
        <>
          <AjustarCargoDialogo eventoId={evento.id} cargo={ajustando} onCerrar={() => setAjustando(null)} />
          <AnadirNinosDialogo detalle={data} abierto={anadiendo} onCambiar={setAnadiendo} />
          <Confirmar
            abierto={quitando !== null}
            onCambiar={(v) => !v && setQuitando(null)}
            titulo={`¿Quitar a ${quitando?.educando.nombre ?? ""} del evento?`}
            descripcion="No tendrá que pagarlo y sus hermanos se recalculan. Puedes volver a añadirlo cuando quieras."
            accion="Quitar"
            onConfirmar={() => quitar.mutateAsync({ eventoId: evento.id, cargoId: quitando!.id })}
          />
          <Confirmar
            abierto={borrando}
            onCambiar={setBorrando}
            titulo={`¿Borrar «${evento.nombre}»?`}
            descripcion="Se borran el evento y todo lo que debía cada niño. No se puede deshacer."
            accion="Borrar evento"
            peligrosa
            onConfirmar={async () => {
              await borrar.mutateAsync(evento.id);
              navigate("/eventos", { replace: true });
            }}
          />
        </>
      )}
    </div>
  );
};
