import { Check, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Confirmar } from "@/components/Confirmar";
import { useEducandos } from "@/features/educandos/educandos.api";
import { useSecciones } from "@/features/secciones/secciones.api";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { useAceptarEnvio, useRechazarEnvio } from "./pedidos.api";
import type { Envio, Semaforo } from "./pedidos.types";
import { describirLinea } from "./pedidos.utils";

const SEMAFORO: Record<Semaforo, { etiqueta: string; clase: string; punto: string }> = {
  RECONOCIDO: { etiqueta: "Reconocido", clase: "bg-bosque-claro text-bosque", punto: "bg-bosque" },
  DUDOSO: { etiqueta: "Revisa a quién", clase: "bg-ambar-claro text-[color-mix(in_oklch,var(--color-ambar)_65%,var(--color-tinta))]", punto: "bg-ambar" },
  SIN_COINCIDENCIA: { etiqueta: "No está en el listado", clase: "bg-rojo-claro text-rojo", punto: "bg-rojo" },
};

const plano = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const fechaHora = (f: string) => new Date(f).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// D-68: un envio del formulario publico. Tesoreria elige a quien corresponde (propuesto por el semaforo) y lo acepta,
// o lo rechaza. Nada cuenta hasta aceptarlo.
export const EnvioTarjeta = ({ pedidoId, envio, cerrado }: { pedidoId: string; envio: Envio; cerrado: boolean }) => {
  const { data: secciones = [] } = useSecciones();
  const { data: lista } = useEducandos();
  const aceptar = useAceptarEnvio();
  const rechazar = useRechazarEnvio();
  const [elegido, setElegido] = useState<string | null>(envio.semaforo === "RECONOCIDO" ? envio.candidatos[0].educandoId : null);
  const [reemplazar, setReemplazar] = useState(false);
  const [buscando, setBuscando] = useState(envio.candidatos.length === 0);
  const [busqueda, setBusqueda] = useState("");
  const [rechazando, setRechazando] = useState(false);

  const seccion = (id: string) => secciones.find((s) => s.id === id)?.nombre ?? "";
  const otros = useMemo(() => {
    const texto = plano(busqueda.trim());
    if (!texto) return [];
    return (lista?.educandos ?? [])
      .filter((e) => plano(`${e.nombre} ${e.apellidos}`).includes(texto))
      .slice(0, 8)
      .map((e) => ({ educandoId: e.id, nombre: e.nombre, apellidos: e.apellidos, seccionId: e.seccionId }));
  }, [lista, busqueda]);
  const opciones = [...envio.candidatos, ...otros.filter((o) => !envio.candidatos.some((c) => c.educandoId === o.educandoId))];
  const error = aceptar.error;
  const s = SEMAFORO[envio.semaforo];

  return (
    <article aria-label={`Pedido de ${envio.nombre} ${envio.apellidos}`} className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold">
            {envio.nombre} {envio.apellidos}
          </p>
          <p className="text-sm text-suave">
            Dice {seccion(envio.seccionId) || "una sección que ya no existe"} · {fechaHora(envio.creadoEn)}
          </p>
        </div>
        <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.clase)}>
          <span className={cx("size-2 rounded-full", s.punto)} aria-hidden /> {s.etiqueta}
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-linea rounded-2xl bg-hundido px-4">
        {envio.lineas.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <span>{describirLinea(l.articulo, l.elecciones)}</span>
            <span className="tabular-nums">{euros(l.importeCentimos)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 py-2 text-sm font-bold">
          <span>Total</span>
          <span className="tabular-nums">{euros(envio.totalCentimos)}</span>
        </li>
      </ul>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">¿Para quién es?</legend>
        {opciones.map((c) => (
          <label key={c.educandoId} className={cx("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1", elegido === c.educandoId ? "bg-bosque-claro ring-bosque" : "ring-linea hover:bg-hundido")}>
            <input
              type="radio"
              name={`envio-${envio.id}`}
              checked={elegido === c.educandoId}
              onChange={() => setElegido(c.educandoId)}
              className="size-4 accent-[var(--color-bosque)]"
            />
            <span className="text-sm">
              <span className="font-semibold">{c.nombre}</span> {c.apellidos} <span className="text-suave">· {seccion(c.seccionId)}</span>
            </span>
          </label>
        ))}
        {buscando ? (
          <label className="relative">
            <span className="sr-only">Buscar a otra persona</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" aria-hidden />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el listado…"
              className="h-11 w-full rounded-xl bg-superficie pr-3 pl-10 text-base ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
            />
          </label>
        ) : (
          <button type="button" onClick={() => setBuscando(true)} className="w-fit text-sm font-semibold text-bosque">
            Es otra persona
          </button>
        )}
        {envio.semaforo === "SIN_COINCIDENCIA" && (
          <p className="text-sm text-suave">Si es alguien nuevo, dalo de alta en Educandos y vuelve aquí.</p>
        )}
      </fieldset>

      {envio.posibleCambio && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-ambar-claro p-3 text-sm">
          <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} className="mt-0.5 size-5 accent-[var(--color-bosque)]" />
          <span>
            <span className="block font-semibold">Parece un cambio de un pedido anterior</span>
            Márcalo para sustituir lo que ya tenía; si no, se suma.
          </span>
        </label>
      )}

      {error && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Boton variante="secundario" onClick={() => setRechazando(true)}>
          <X className="size-4" aria-hidden /> Rechazar
        </Boton>
        <Boton
          disabled={!elegido || cerrado}
          cargando={aceptar.isPending}
          onClick={() => elegido && aceptar.mutate({ id: pedidoId, envioId: envio.id, educandoId: elegido, reemplazar })}
        >
          <Check className="size-4" aria-hidden /> Aceptar
        </Boton>
      </div>
      <Confirmar
        abierto={rechazando}
        onCambiar={setRechazando}
        titulo="¿Rechazar este pedido?"
        descripcion={`Se borra el envío de ${envio.nombre} ${envio.apellidos} y no se podrá recuperar. Si era un error, la familia tendrá que enviarlo otra vez.`}
        accion="Rechazar"
        peligrosa
        onConfirmar={() => rechazar.mutateAsync({ id: pedidoId, envioId: envio.id })}
      />
    </article>
  );
};
