import { ArrowLeft, ArrowRight, CircleCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { Confirmar } from "@/components/Confirmar";
import { ChipSeccion } from "@/features/secciones/ChipSeccion";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { usePasarDeCurso, usePropuestaPaso } from "./cursos.api";
import type { FilaPaso, PropuestaPaso } from "./cursos.types";

// D-79 a D-81: el asistente de paso de curso. La app propone por edad; Admin revisa y confirma.

type Filtro = "todos" | "cambian" | "noSiguen" | "sinFecha";
const FILTROS: { valor: Filtro; texto: string }[] = [
  { valor: "todos", texto: "Todos" },
  { valor: "cambian", texto: "Cambian de sección" },
  { valor: "noSiguen", texto: "No siguen" },
  { valor: "sinFecha", texto: "Sin fecha de nacimiento" },
];

export const PasoCursoPagina = () => {
  const { data, isPending, error } = usePropuestaPaso();
  if (isPending) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;
  return <Asistente propuesta={data} />;
};

const Asistente = ({ propuesta }: { propuesta: PropuestaPaso }) => {
  const { origen, destino, destinoExiste, secciones, filas } = propuesta;
  const navegar = useNavigate();
  const pasar = usePasarDeCurso();
  // A donde va cada niño; null si no sigue (D-80). Empieza con lo que propone la app.
  const [destinos, setDestinos] = useState(() => new Map(filas.map((f) => [f.educandoId, f.propuesta.seccionId])));
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [confirmando, setConfirmando] = useState(false);

  const seccionDe = useMemo(() => new Map(secciones.map((s) => [s.id, s])), [secciones]);
  const anio = destino.slice(0, 4);

  const cuentas = useMemo(() => {
    let cambian = 0;
    let noSiguen = 0;
    for (const f of filas) {
      const d = destinos.get(f.educandoId);
      if (d === null) noSiguen++;
      else if (d !== f.seccionActualId) cambian++;
    }
    return { cambian, noSiguen, siguen: filas.length - noSiguen, sinFecha: filas.filter((f) => f.edad === null).length };
  }, [filas, destinos]);

  const visible = (f: FilaPaso) => {
    const d = destinos.get(f.educandoId);
    if (filtro === "cambian") return d !== null && d !== f.seccionActualId;
    if (filtro === "noSiguen") return d === null;
    if (filtro === "sinFecha") return f.edad === null;
    return true;
  };

  // Por la seccion en la que estan ahora, en el orden de las secciones.
  const grupos = secciones
    .map((s) => ({ seccion: s, filas: filas.filter((f) => f.seccionActualId === s.id && visible(f)) }))
    .filter((g) => g.filas.length > 0);

  const cambiar = (educandoId: string, seccionId: string | null) =>
    setDestinos((actual) => new Map(actual).set(educandoId, seccionId));

  const confirmar = async () => {
    await pasar.mutateAsync({ origenId: origen.id, filas: filas.map((f) => ({ educandoId: f.educandoId, seccionId: destinos.get(f.educandoId) ?? null })) });
    navegar("/educandos", { replace: true });
  };

  return (
    <section aria-labelledby="titulo-paso" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link to=".." relative="path" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> Curso
        </Link>
        <h2 id="titulo-paso" className="font-display text-2xl font-bold text-balance">
          Paso de <span className="tabular-nums">{origen.nombre}</span> a <span className="tabular-nums">{destino}</span>
        </h2>
        <p className="max-w-prose text-sm text-suave">
          La app propone subir de sección a quien cumpla en {anio} más años que la edad máxima de su sección. Revisa a
          dónde va cada uno: nada cambia hasta que confirmes.
        </p>
      </div>

      {destinoExiste && (
        <Aviso tono="error">
          El curso {destino} ya existe (seguramente se creó al importar un listado). Para pasar de curso de esta forma no
          puede existir todavía.
        </Aviso>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { etiqueta: `Siguen en ${destino}`, valor: cuentas.siguen },
          { etiqueta: "Cambian de sección", valor: cuentas.cambian },
          { etiqueta: "No siguen", valor: cuentas.noSiguen },
          { etiqueta: "Sin fecha de nacimiento", valor: cuentas.sinFecha },
        ].map((c) => (
          <div key={c.etiqueta} className="rounded-2xl bg-superficie p-4 ring-1 ring-linea">
            <dt className="text-xs font-semibold text-suave">{c.etiqueta}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{c.valor}</dd>
          </div>
        ))}
      </dl>

      {cuentas.sinFecha > 0 && (
        <Aviso>
          {cuentas.sinFecha === 1 ? "Un niño no tiene" : `${cuentas.sinFecha} niños no tienen`} fecha de nacimiento: se
          quedan en su sección salvo que elijas otra.
        </Aviso>
      )}

      <div role="radiogroup" aria-label="Mostrar" className="-m-1 flex gap-1 overflow-x-auto p-1 sin-barra">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            role="radio"
            aria-checked={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cx(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors",
              filtro === f.valor ? "bg-tinta text-fondo ring-tinta" : "text-suave ring-linea hover:bg-hundido hover:text-tinta",
            )}
          >
            {f.texto}
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <p className="rounded-3xl bg-superficie p-6 text-center text-sm text-suave ring-1 ring-linea">Nadie en esta lista.</p>
      ) : (
        grupos.map(({ seccion, filas: deLaSeccion }) => (
          <section key={seccion.id} aria-label={`Ahora en ${seccion.nombre}`} className="rounded-3xl bg-superficie p-2 ring-1 ring-linea sm:p-3">
            <h3 className="flex items-center gap-2 px-2 pt-1 pb-2 text-sm font-semibold">
              <ChipSeccion seccion={seccion} />
              <span className="text-suave">
                {seccion.edadMaxima === null ? "sin edad máxima" : `hasta los ${seccion.edadMaxima} años`} · {deLaSeccion.length}
              </span>
            </h3>
            <ul className="divide-y divide-linea">
              {deLaSeccion.map((f) => (
                <FilaNino
                  key={f.educandoId}
                  fila={f}
                  anio={anio}
                  destino={destinos.get(f.educandoId) ?? null}
                  secciones={secciones.filter((s) => !s.archivada || s.id === f.seccionActualId)}
                  nombreDe={(id) => seccionDe.get(id)?.nombre ?? ""}
                  onCambiar={(seccionId) => cambiar(f.educandoId, seccionId)}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <div className="sticky bottom-20 flex flex-col-reverse gap-2 rounded-3xl bg-superficie/95 p-3 ring-1 ring-linea backdrop-blur sm:flex-row sm:items-center sm:justify-between md:bottom-4">
        <Link
          to=".."
          relative="path"
          className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold text-suave transition hover:bg-hundido hover:text-tinta"
        >
          Cancelar
        </Link>
        <Boton onClick={() => setConfirmando(true)} disabled={destinoExiste || filas.length === 0}>
          <CircleCheck className="size-4" aria-hidden /> Pasar a {destino}
        </Boton>
      </div>

      <Confirmar
        abierto={confirmando}
        onCambiar={setConfirmando}
        titulo={`¿Pasar a ${destino}?`}
        descripcion={`Se matricularán ${cuentas.siguen} niños en ${destino}${cuentas.noSiguen ? ` y ${cuentas.noSiguen} no seguirán` : ""}. ${destino} será el curso activo y ${origen.nombre} quedará para consultar, con sus deudas pendientes. No se puede deshacer desde la app.`}
        accion={`Pasar a ${destino}`}
        onConfirmar={confirmar}
      />
    </section>
  );
};

type PropsFila = {
  fila: FilaPaso;
  anio: string;
  destino: string | null;
  secciones: PropuestaPaso["secciones"];
  nombreDe: (seccionId: string) => string;
  onCambiar: (seccionId: string | null) => void;
};

const FilaNino = ({ fila, anio, destino, secciones, nombreDe, onCambiar }: PropsFila) => {
  const sigue = destino !== null;
  const nombre = `${fila.nombre} ${fila.apellidos}`.trim();
  const cambia = sigue && destino !== fila.seccionActualId;

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5">
      <label className="flex min-w-0 flex-1 basis-56 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={sigue}
          // Al volver a marcarlo, vuelve a lo que proponia la app (o a su seccion, si proponia que terminara).
          onChange={() => onCambiar(sigue ? null : (fila.propuesta.seccionId ?? fila.seccionActualId))}
          aria-label={`${nombre} sigue en el curso que viene`}
          className="size-5 shrink-0 accent-[var(--color-bosque)]"
        />
        <span className="min-w-0">
          <span className={cx("block truncate font-semibold", !sigue && "text-suave line-through")}>
            {fila.nombre} <span className="font-normal text-suave">{fila.apellidos}</span>
          </span>
          <span className="block text-xs text-suave">
            {fila.edad === null ? "Sin fecha de nacimiento" : `Cumple ${fila.edad} en ${anio}`}
          </span>
        </span>
      </label>

      <span
        className={cx(
          "text-xs font-semibold",
          !sigue ? "text-[color-mix(in_oklch,var(--color-ambar)_65%,var(--color-tinta))]" : cambia ? "text-bosque" : "text-suave",
        )}
      >
        {!sigue
          ? fila.propuesta.motivo === "TERMINA" ? "Termina" : "No sigue"
          : cambia
            ? <span className="inline-flex items-center gap-1"><ArrowRight className="size-3.5" aria-hidden /> {nombreDe(destino)}</span>
            : "Se queda"}
      </span>

      <label className="w-full sm:w-44">
        <span className="sr-only">Sección de {nombre} en el curso que viene</span>
        <select
          value={destino ?? ""}
          onChange={(e) => onCambiar(e.target.value || null)}
          className="h-11 w-full rounded-2xl bg-superficie px-3 text-base ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
        >
          <option value="">No sigue</option>
          {secciones.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>
    </li>
  );
};
