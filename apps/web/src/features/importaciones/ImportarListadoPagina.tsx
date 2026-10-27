import { ArrowLeft, CircleCheck, Lock, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Pasos } from "@/components/Pasos";
import { SubirArchivo } from "@/components/SubirArchivo";
import { ChipSeccion } from "@/features/secciones/ChipSeccion";
import { useSecciones } from "@/features/secciones/secciones.api";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { useAnalizarListado, useConfirmarListado, type ConfirmacionListado } from "./importaciones.api";
import { MarcasPagado } from "./MarcasPagado";
import type { AnalisisListado, ResultadoImportacion } from "./importaciones.types";

const PASOS = ["Subir el Excel", "Secciones y curso", "Revisar familias"];

// D-28: asistente en 3 pasos. Nada se guarda hasta el boton final.
export const ImportarListadoPagina = () => {
  const [paso, setPaso] = useState(0);
  const [analisis, setAnalisis] = useState<AnalisisListado | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [secciones, setSecciones] = useState<Record<string, string>>({});
  const [curso, setCurso] = useState("");
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());
  // D-44: clave de la columna con marcas "Pagado" -> evento al que corresponde (sin elegir, no se importa).
  const [columnasPago, setColumnasPago] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

  const analizar = useAnalizarListado();
  const confirmar = useConfirmarListado();

  const empezar = async (archivo: File) => {
    setNombreArchivo(archivo.name);
    // Si falla, el error se muestra en el paso 1 (estado de la mutacion).
    const res = await analizar.mutateAsync(archivo).catch(() => null);
    if (!res) return;
    setAnalisis(res);
    setCurso(res.cursoSugerido);
    setSecciones({});
    setExcluidos(new Set());
    setColumnasPago({});
    setPaso(1);
  };

  const importar = async () => {
    if (!analisis) return;
    const datos: ConfirmacionListado = {
      curso,
      secciones,
      familias: analisis.familias
        .map((f) => ({
          existenteId: f.existenteId,
          nombre: f.nombre,
          responsables: f.responsables,
          ninos: f.ninos
            .filter((n) => !excluidos.has(n.clave))
            .map((n) => ({ existenteId: n.existenteId, nombre: n.nombre, apellidos: n.apellidos, bloque: n.bloque, pagado: n.pagado })),
        }))
        .filter((f) => f.ninos.length > 0),
      columnasPago: analisis.columnasPago.flatMap((c) =>
        columnasPago[c.clave] ? [{ clave: c.clave, titulo: c.titulo, eventoId: columnasPago[c.clave] }] : [],
      ),
    };
    setResultado(await confirmar.mutateAsync(datos));
  };

  if (resultado) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">Listado importado</h1>
        <Aviso tono="exito">
          Curso {resultado.curso.nombre}: {resultado.ninosNuevos} niños nuevos en {resultado.familiasNuevas} familias nuevas
          {resultado.ninosActualizados > 0 && ` y ${resultado.ninosActualizados} ya existentes actualizados`}.
        </Aviso>
        {resultado.marcasImportadas + resultado.marcasSinCargo + resultado.marcasYaPagadas > 0 && (
          <Aviso tono={resultado.marcasSinCargo ? "info" : "exito"}>
            Marcas «Pagado»: {resultado.marcasImportadas} apuntadas como pagos
            {resultado.marcasYaPagadas > 0 && `, ${resultado.marcasYaPagadas} ya estaban pagadas`}
            {resultado.marcasSinCargo > 0 && `, ${resultado.marcasSinCargo} de niños que no tienen ese evento (no se han importado)`}.
          </Aviso>
        )}
        <Link to="/educandos" className="inline-flex h-12 w-fit items-center rounded-full bg-bosque px-5 text-sm font-semibold text-fondo">
          Ver educandos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link to="/educandos" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> Educandos
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">Importar listado</h1>
        <Pasos pasos={PASOS} actual={paso} etiqueta="Pasos de la importación" />
      </div>

      {paso === 0 && <PasoSubir onArchivo={empezar} cargando={analizar.isPending} error={analizar.error} />}
      {paso === 1 && analisis && (
        <PasoSecciones
          analisis={analisis}
          nombreArchivo={nombreArchivo}
          secciones={secciones}
          onSecciones={setSecciones}
          curso={curso}
          onCurso={setCurso}
          columnasPago={columnasPago}
          onColumnasPago={setColumnasPago}
          onAtras={() => setPaso(0)}
          onSiguiente={() => setPaso(2)}
        />
      )}
      {paso === 2 && analisis && (
        <PasoRevisar
          analisis={analisis}
          secciones={secciones}
          excluidos={excluidos}
          onExcluidos={setExcluidos}
          onAtras={() => setPaso(1)}
          onImportar={importar}
          importando={confirmar.isPending}
          error={confirmar.error}
        />
      )}
    </div>
  );
};

const PasoSubir = ({ onArchivo, cargando, error }: { onArchivo: (f: File) => void; cargando: boolean; error: unknown }) => {
  return (
    <section className="flex flex-col gap-4">
      <SubirArchivo titulo="Elige el Excel del listado" tituloCargando="Leyendo el listado…" onArchivo={onArchivo} cargando={cargando} />
      {Boolean(error) && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      <div className="grid gap-3 text-sm text-suave sm:grid-cols-2">
        <p className="rounded-2xl bg-hundido p-4">
          <strong className="block text-tinta">Qué formato espera</strong>
          Una columna con los padres separados por «/» y otra con el niño. Cada vez que se repite la cabecera empieza
          un bloque nuevo, que en el siguiente paso asignarás a una sección.
        </p>
        <p className="flex gap-2.5 rounded-2xl bg-hundido p-4">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong className="block text-tinta">El fichero no se guarda</strong>
            Se lee para proponerte las familias y se descarta. Nada queda guardado hasta que confirmes en el paso 3.
          </span>
        </p>
      </div>
    </section>
  );
};

type PropsSecciones = {
  analisis: AnalisisListado;
  nombreArchivo: string;
  secciones: Record<string, string>;
  onSecciones: (s: Record<string, string>) => void;
  curso: string;
  onCurso: (c: string) => void;
  columnasPago: Record<string, string>;
  onColumnasPago: (c: Record<string, string>) => void;
  onAtras: () => void;
  onSiguiente: () => void;
};

const PasoSecciones = (props: PropsSecciones) => {
  const { analisis, nombreArchivo, secciones, onSecciones, curso, onCurso, columnasPago, onColumnasPago, onAtras, onSiguiente } = props;
  const { data: todas = [] } = useSecciones();
  const activas = todas.filter((s) => !s.archivada);
  const faltan = analisis.bloques.filter((b) => !secciones[String(b.indice)]).length;
  const cursoValido = /^\d{4}-\d{2}$/.test(curso);
  const repetidas = Object.values(secciones).filter((id, i, a) => a.indexOf(id) !== i).length > 0;
  const otrasColumnas = analisis.columnasIgnoradas.filter((c) => !analisis.columnasPago.some((p) => p.titulo === c));

  return (
    <section className="flex flex-col gap-5">
      <p className="text-suave">
        En <strong className="text-tinta">{nombreArchivo}</strong> hay {analisis.bloques.length}{" "}
        {analisis.bloques.length === 1 ? "bloque" : "bloques"} con{" "}
        {analisis.bloques.reduce((n, b) => n + b.total, 0)} niños. ¿A qué sección corresponde cada uno?
      </p>

      <ol className="flex flex-col gap-3">
        {analisis.bloques.map((b) => (
          <li key={b.indice} className="flex flex-col gap-3 rounded-3xl bg-superficie p-4 ring-1 ring-linea sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Bloque {b.indice + 1} · {b.total} niños</p>
              <p className="truncate text-sm text-suave">{b.ejemplos.join(", ")}{b.total > b.ejemplos.length && "…"}</p>
            </div>
            <label className="flex flex-col gap-1 sm:w-48">
              <span className="sr-only">Sección del bloque {b.indice + 1}</span>
              <select
                value={secciones[String(b.indice)] ?? ""}
                onChange={(e) => onSecciones({ ...secciones, [String(b.indice)]: e.target.value })}
                className="h-12 rounded-2xl bg-superficie px-4 text-base ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
              >
                <option value="">Elige sección…</option>
                {activas.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ol>
      {repetidas && <Aviso tono="info">Hay dos bloques en la misma sección. Si es a propósito, sigue sin problema.</Aviso>}

      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-sm font-semibold">Curso</span>
        <input
          value={curso}
          onChange={(e) => onCurso(e.target.value)}
          placeholder="2026-27"
          aria-invalid={!cursoValido || undefined}
          className="h-12 rounded-2xl bg-superficie px-4 text-base ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
        />
        <span className={cx("text-sm", cursoValido ? "text-suave" : "font-medium text-rojo")}>
          {cursoValido ? "Las secciones se guardan para este curso." : "Escríbelo con la forma 2026-27."}
        </span>
      </label>

      {analisis.columnasPago.length > 0 && (
        <MarcasPagado analisis={analisis} curso={curso} valor={columnasPago} onCambiar={onColumnasPago} />
      )}
      {otrasColumnas.length > 0 && <Aviso tono="info">Se ignoran estas columnas: {otrasColumnas.join(", ")}.</Aviso>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Boton variante="secundario" onClick={onAtras}>Subir otro fichero</Boton>
        <Boton onClick={onSiguiente} disabled={faltan > 0 || !cursoValido}>
          {faltan > 0 ? `Faltan ${faltan} ${faltan === 1 ? "bloque" : "bloques"}` : "Revisar familias"}
        </Boton>
      </div>
    </section>
  );
};

type PropsRevisar = {
  analisis: AnalisisListado;
  secciones: Record<string, string>;
  excluidos: Set<string>;
  onExcluidos: (s: Set<string>) => void;
  onAtras: () => void;
  onImportar: () => void;
  importando: boolean;
  error: unknown;
};

const PasoRevisar = ({ analisis, secciones, excluidos, onExcluidos, onAtras, onImportar, importando, error }: PropsRevisar) => {
  const { data: todas = [] } = useSecciones();
  const [soloAvisos, setSoloAvisos] = useState(false);
  const seccionDe = (id: string | null | undefined) => todas.find((s) => s.id === id);

  const ninos = analisis.familias.flatMap((f) => f.ninos);
  const incluidos = ninos.filter((n) => !excluidos.has(n.clave));
  const cuentas = useMemo(
    () => ({
      nuevos: incluidos.filter((n) => !n.existenteId).length,
      existentes: incluidos.filter((n) => n.existenteId).length,
      familiasNuevas: analisis.familias.filter((f) => !f.existenteId && f.ninos.some((n) => !excluidos.has(n.clave))).length,
      conAvisos: analisis.familias.filter((f) => f.avisos.length > 0).length,
    }),
    [analisis, excluidos, incluidos],
  );
  const familias = soloAvisos ? analisis.familias.filter((f) => f.avisos.length > 0) : analisis.familias;

  const alternar = (clave: string) => {
    const siguiente = new Set(excluidos);
    if (siguiente.has(clave)) siguiente.delete(clave);
    else siguiente.add(clave);
    onExcluidos(siguiente);
  };

  return (
    <section className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { etiqueta: "Niños nuevos", valor: cuentas.nuevos },
          { etiqueta: "Ya estaban", valor: cuentas.existentes },
          { etiqueta: "Familias nuevas", valor: cuentas.familiasNuevas },
          { etiqueta: "Para revisar", valor: cuentas.conAvisos },
        ].map((c) => (
          <div key={c.etiqueta} className="rounded-2xl bg-superficie p-4 ring-1 ring-linea">
            <dt className="text-xs font-semibold text-suave">{c.etiqueta}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{c.valor}</dd>
          </div>
        ))}
      </dl>

      {analisis.noAparecen.length > 0 && (
        <details className="rounded-2xl bg-ambar-claro p-4 text-sm">
          <summary className="cursor-pointer font-semibold">
            {analisis.noAparecen.length} niños del curso actual no aparecen en este listado
          </summary>
          <p className="mt-2 text-suave">No se darán de baja solos: si se han ido, hazlo desde la ficha de su familia.</p>
          <ul className="mt-2 list-inside list-disc">
            {analisis.noAparecen.map((n) => <li key={n.id}>{n.nombre}</li>)}
          </ul>
        </details>
      )}

      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm font-semibold">
        <input type="checkbox" checked={soloAvisos} onChange={(e) => setSoloAvisos(e.target.checked)} className="size-5 accent-[var(--color-bosque)]" />
        Ver solo las familias con algo que revisar ({cuentas.conAvisos})
      </label>

      <ul className="flex flex-col gap-3">
        {familias.map((f) => (
          <li key={f.clave} className="rounded-3xl bg-superficie p-4 ring-1 ring-linea">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-semibold">{f.nombre}</p>
              {f.existenteId && <span className="text-xs font-semibold text-azul">Ya existe</span>}
            </div>
            <p className="text-sm text-suave">{f.responsables.length ? f.responsables.join(" · ") : "Sin responsables"}</p>
            {f.avisos.map((a) => (
              <p key={a} className="mt-2 flex gap-2 text-sm text-[color-mix(in_oklch,var(--color-ambar)_65%,var(--color-tinta))]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {a}
              </p>
            ))}
            <ul className="mt-3 flex flex-col gap-1">
              {f.ninos.map((n) => {
                const nueva = seccionDe(secciones[String(n.bloque)]);
                const cambia = n.existenteId && n.seccionActualId && n.seccionActualId !== secciones[String(n.bloque)];
                return (
                  <li key={n.clave}>
                    <label className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-1.5 hover:bg-hundido">
                      <input
                        type="checkbox"
                        checked={!excluidos.has(n.clave)}
                        onChange={() => alternar(n.clave)}
                        aria-label={`Importar a ${n.nombre} ${n.apellidos}`.trim()}
                        className="size-5 accent-[var(--color-bosque)]"
                      />
                      <span className={cx("min-w-0 flex-1", excluidos.has(n.clave) && "text-suave line-through")}>
                        {n.nombre} <span className="text-suave">{n.apellidos}</span>
                      </span>
                      {nueva && <ChipSeccion seccion={nueva} />}
                      <span className={cx("text-xs font-semibold", n.existenteId ? "text-azul" : "text-bosque")}>
                        {n.existenteId ? (cambia ? "Cambia de sección" : "Ya estaba") : "Nuevo"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      {Boolean(error) && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      <div className="sticky bottom-20 flex flex-col-reverse gap-2 rounded-3xl bg-superficie/95 p-3 ring-1 ring-linea backdrop-blur sm:flex-row sm:justify-between md:bottom-4">
        <Boton variante="secundario" onClick={onAtras}>Atrás</Boton>
        <Boton onClick={onImportar} cargando={importando} disabled={incluidos.length === 0}>
          <CircleCheck className="size-4" aria-hidden /> Importar {incluidos.length} niños
        </Boton>
      </div>
    </section>
  );
};
