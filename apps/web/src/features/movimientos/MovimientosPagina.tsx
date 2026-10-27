import { Inbox, Undo2, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
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

const PESTANAS: { valor: EstadoMovimiento; texto: string; parametro: string | null }[] = [
  { valor: "DUDA", texto: "Dudas", parametro: null },
  { valor: "CLASIFICADO", texto: "Clasificados", parametro: "clasificados" },
];

// D-41: los ingresos importados del banco, en Dudas o ya clasificados (con "Deshacer").
export const MovimientosPagina = () => {
  const [parametros, setParametros] = useSearchParams();
  const estado: EstadoMovimiento = parametros.get("ver") === "clasificados" ? "CLASIFICADO" : "DUDA";
  const { data, isPending, error } = useMovimientos(estado);
  const [aDeshacer, setADeshacer] = useState<Movimiento | null>(null);
  const deshacer = useDeshacerMovimiento();

  const cuenta = (valor: EstadoMovimiento) => (valor === "DUDA" ? data?.contadores.dudas : data?.contadores.clasificados);
  const nadaImportado = data ? data.contadores.dudas + data.contadores.clasificados === 0 : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Movimientos</h1>
          <p className="mt-1 text-suave">Los ingresos del banco y a quién se han atribuido.</p>
        </div>
        <Link
          to="/movimientos/importar"
          className="inline-flex h-12 items-center gap-2 rounded-full bg-bosque px-5 text-sm font-semibold text-fondo hover:brightness-110"
        >
          <Upload className="size-4" aria-hidden /> Importar del banco
        </Link>
      </div>

      <div role="group" aria-label="Qué movimientos ver" className="flex w-fit gap-1 rounded-full bg-hundido p-1">
        {PESTANAS.map((p) => (
          <button
            key={p.valor}
            type="button"
            aria-pressed={estado === p.valor}
            onClick={() => setParametros(p.parametro ? { ver: p.parametro } : {}, { replace: true })}
            className={cx(
              "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
              estado === p.valor ? "bg-superficie text-tinta shadow-sm ring-1 ring-linea" : "text-suave hover:text-tinta",
            )}
          >
            {p.texto}
            {cuenta(p.valor) !== undefined && <span className="tabular-nums text-suave">{cuenta(p.valor)}</span>}
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
            {nadaImportado ? "Aún no hay movimientos" : estado === "DUDA" ? "No hay dudas" : "Aún no hay movimientos clasificados"}
          </p>
          <p className="max-w-sm text-sm text-suave">
            {nadaImportado
              ? "Importa el Excel de movimientos del banco: los pagos sin duda se clasifican solos y el resto queda aquí, en Dudas."
              : estado === "DUDA"
                ? "Todo lo importado del banco está clasificado."
                : "Ningún ingreso se ha podido clasificar solo todavía: los tienes en Dudas."}
          </p>
        </div>
      ) : (
        <>
          {estado === "DUDA" && (
            <Aviso tono="info">
              Estos ingresos no se han clasificado solos. Pronto podrás resolverlos aquí; de momento verás por qué y qué se sugiere.
            </Aviso>
          )}
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.movimientos.map((m) => (
              <FilaMovimiento
                key={m.id}
                movimiento={m}
                acciones={
                  m.estado === "CLASIFICADO" && (
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
        descripcion={
          aDeshacer?.origen === "LISTADO"
            ? "La marca del listado se borrará y lo que pagaba volverá a estar pendiente."
            : `El ingreso de ${aDeshacer ? euros(aDeshacer.importeCentimos) : ""} pasará a Dudas y lo que pagaba volverá a estar pendiente.`
        }
        accion="Deshacer"
        onConfirmar={() => deshacer.mutateAsync(aDeshacer!.id)}
      />
    </div>
  );
};
