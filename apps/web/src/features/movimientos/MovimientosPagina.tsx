import { HandCoins, Inbox, Undo2, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { Confirmar } from "@/components/Confirmar";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { FilaMovimiento } from "./FilaMovimiento";
import { useDeshacerMovimiento, useMovimientos } from "./movimientos.api";
import type { EstadoMovimiento, Movimiento } from "./movimientos.types";

type Pestana = { valor: EstadoMovimiento; texto: string; parametro: string | null; contador: "dudas" | "clasificados" | "otros" };
const PESTANAS: Pestana[] = [
  { valor: "DUDA", texto: "Dudas", parametro: null, contador: "dudas" },
  { valor: "CLASIFICADO", texto: "Clasificados", parametro: "clasificados", contador: "clasificados" },
  { valor: "OTRO_INGRESO", texto: "Otros ingresos", parametro: "otros", contador: "otros" },
];

// Qué pasa al deshacer, según qué es (D-5, D-49, D-51).
const textoDeshacer = (m: Movimiento) => {
  if (m.estado === "OTRO_INGRESO") return "Volverá a Dudas.";
  if (m.origen === "MANUAL") return "Se borrará este pago apuntado a mano y lo que pagaba volverá a estar pendiente.";
  if (m.origen === "LISTADO") return "La marca del listado se borrará y lo que pagaba volverá a estar pendiente.";
  if (m.cruce) return "El ingreso volverá a Dudas y el pago apuntado recuperará su reparto.";
  return `El ingreso de ${euros(m.importeCentimos)} pasará a Dudas y lo que pagaba volverá a estar pendiente.`;
};

// D-41: los ingresos importados del banco, en Dudas o ya clasificados (con "Deshacer").
export const MovimientosPagina = () => {
  const [parametros, setParametros] = useSearchParams();
  const estado = PESTANAS.find((p) => p.parametro === parametros.get("ver"))?.valor ?? "DUDA";
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const { data, isPending, error } = useMovimientos(estado);
  const [aDeshacer, setADeshacer] = useState<Movimiento | null>(null);
  const deshacer = useDeshacerMovimiento();

  const nadaImportado = data ? data.contadores.dudas + data.contadores.clasificados + data.contadores.otros === 0 : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Movimientos</h1>
          <p className="mt-1 text-suave">Los ingresos del banco y a quién se han atribuido.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/movimientos/nuevo"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-superficie px-5 text-sm font-semibold ring-1 ring-linea hover:bg-hundido"
          >
            <HandCoins className="size-4" aria-hidden /> Apuntar pago a mano
          </Link>
          <Link
            to="/movimientos/importar"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-bosque px-5 text-sm font-semibold text-fondo hover:brightness-110"
          >
            <Upload className="size-4" aria-hidden /> Importar del banco
          </Link>
        </div>
      </div>
      {aviso && <Aviso tono="exito">{aviso}</Aviso>}

      <div role="group" aria-label="Qué movimientos ver" className="-mx-1 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-hundido p-1">
        {PESTANAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            aria-pressed={estado === p.valor}
            onClick={() => setParametros(p.parametro ? { ver: p.parametro } : {}, { replace: true })}
            className={cx(
              "flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
              estado === p.valor ? "bg-superficie text-tinta shadow-sm ring-1 ring-linea" : "text-suave hover:text-tinta",
            )}
          >
            {p.texto}
            {data && <span className="tabular-nums text-suave">{data.contadores[p.contador]}</span>}
          </button>
        ))}
      </div>

      {isPending ? (
        <Cargando />
      ) : error ? (
        <Aviso tono="error">{mensajeDeError(error)}</Aviso>
      ) : data.movimientos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-superficie p-10 text-center ring-1 ring-linea">
          <span className="grid size-12 place-items-center rounded-2xl bg-bosque-claro text-bosque">
            <Inbox className="size-6" aria-hidden />
          </span>
          <p className="font-display text-xl font-bold">
            {nadaImportado ? "Aún no hay movimientos" : estado === "DUDA" ? "No hay dudas" : estado === "OTRO_INGRESO" ? "Sin otros ingresos" : "Aún no hay movimientos clasificados"}
          </p>
          <p className="max-w-sm text-sm text-suave">
            {nadaImportado
              ? "Importa el Excel de movimientos del banco: los pagos sin duda se clasifican solos y el resto queda aquí, en Dudas."
              : estado === "DUDA"
                ? "Todo lo importado del banco está clasificado."
                : estado === "OTRO_INGRESO"
                  ? "Aquí quedan los ingresos que no son de ninguna familia, como una subvención o una donación."
                  : "Ningún ingreso se ha podido clasificar solo todavía: los tienes en Dudas."}
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.movimientos.map((m) => (
              <FilaMovimiento
                key={m.id}
                movimiento={m}
                enlace={m.estado === "DUDA" ? `/movimientos/${m.id}` : undefined}
                acciones={
                  m.estado !== "DUDA" && (
                    <Boton variante="fantasma" tamano="pequeno" onClick={() => setADeshacer(m)} aria-label={`Deshacer ${m.concepto}, ${euros(m.importeCentimos)}`}>
                      <Undo2 className="size-4" aria-hidden /> Deshacer
                    </Boton>
                  )
                }
              />
            ))}
          </ul>
        </>
      )}

      <Confirmar
        abierto={Boolean(aDeshacer)}
        onCambiar={(v) => !v && setADeshacer(null)}
        titulo="¿Deshacer esta clasificación?"
        descripcion={aDeshacer ? textoDeshacer(aDeshacer) : ""}
        accion="Deshacer"
        onConfirmar={() => deshacer.mutateAsync(aDeshacer!.id)}
      />
    </div>
  );
};
