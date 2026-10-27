import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { ETIQUETA_MEDIO, MOTIVOS } from "./movimientos.constants";
import type { CargoDeMovimiento, Movimiento, MovimientoPrevisto } from "./movimientos.types";

const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

const Chip = ({ clase, children }: { clase: string; children: ReactNode }) => (
  <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", clase)}>{children}</span>
);

const AMBAR = "bg-ambar-claro text-[color-mix(in_oklch,var(--color-ambar)_65%,var(--color-tinta))]";
const AZUL = "bg-azul-claro text-azul";
const VERDE = "bg-bosque-claro text-bosque";

// "Cuota de Sara (110 €), Censo de Mateo (30 €)"
const textoCargos = (cargos: CargoDeMovimiento[]) =>
  cargos.map((c) => `${c.evento} de ${c.educando} (${euros(c.importeCentimos)})`).join(", ");

const etiqueta = (m: Movimiento | MovimientoPrevisto) => {
  if (m.motivo) return <Chip clase={m.motivo === "PAGADOR_DESCONOCIDO" ? "bg-rojo-claro text-rojo" : AMBAR}>{MOTIVOS[m.motivo].etiqueta}</Chip>;
  if (!("origen" in m)) return <Chip clase={VERDE}>Se clasifica solo</Chip>;
  if (m.estado === "OTRO_INGRESO") return <Chip clase="bg-hundido text-suave ring-1 ring-linea">Otro ingreso</Chip>;
  if (m.origen === "LISTADO") return <Chip clase={AZUL}>Marcado en el listado</Chip>;
  if (m.origen === "MANUAL") return <Chip clase={AZUL}>A mano{m.medio && ` · ${ETIQUETA_MEDIO[m.medio]}`}</Chip>;
  return m.clasificadoPor ? <Chip clase={AZUL}>Por {m.clasificadoPor.split(/\s+/)[0]}</Chip> : <Chip clase={VERDE}>Automático</Chip>;
};

const Detalle = ({ m }: { m: Movimiento | MovimientoPrevisto }) => {
  const completo = "origen" in m ? m : null;
  if (m.estado === "OTRO_INGRESO") return <p className="mt-3 text-sm text-suave">{completo?.nota || "Sin nota"}</p>;
  if (m.estado === "CLASIFICADO") {
    return (
      <div className="mt-3 flex flex-col gap-1 text-sm">
        <p>
          <strong>{m.familia?.nombre}</strong>
          {m.cargos.length > 0 && <span className="text-suave"> · {textoCargos(m.cargos)}</span>}
        </p>
        {completo && completo.sobranteCentimos > 0 && <p className="text-azul">Saldo a favor: {euros(completo.sobranteCentimos)}</p>}
        {completo?.cruce && (
          <p className="text-suave">
            Es el mismo dinero que {completo.cruce.origen === "LISTADO" ? "la marca del listado" : "el pago apuntado a mano"}
            {completo.cruce.fecha && ` del ${fechaCorta(completo.cruce.fecha)}`}
            {completo.cruce.medio && ` (${ETIQUETA_MEDIO[completo.cruce.medio].toLowerCase()})`}.
          </p>
        )}
      </div>
    );
  }
  const motivo = m.motivo ? MOTIVOS[m.motivo] : null;
  return (
    <div className="mt-3 flex flex-col gap-1 text-sm">
      {motivo && <p className="text-suave">{motivo.explicacion}</p>}
      {m.familia && (
        <p>
          Sugerencia: <strong>{m.familia.nombre}</strong>
          {m.cargos.length > 0 && <span className="text-suave"> · {textoCargos(m.cargos)}</span>}
        </p>
      )}
    </div>
  );
};

type Props = { movimiento: Movimiento | MovimientoPrevisto; acciones?: ReactNode; enlace?: string };

// Un ingreso como en la maqueta: quien paga y el importe arriba; debajo, el estado y a qué se atribuye. Con enlace,
// toda la tarjeta lleva a resolverlo.
export const FilaMovimiento = ({ movimiento: m, acciones, enlace }: Props) => {
  const contenido = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-semibold">{m.concepto}</p>
        <p className="flex items-center gap-1 font-display text-lg font-bold tabular-nums">
          {euros(m.importeCentimos)}
          {enlace && <ChevronRight className="size-4 text-suave" aria-hidden />}
        </p>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {etiqueta(m)}
        {m.fecha && <span className="text-xs text-suave tabular-nums">{fechaCorta(m.fecha)}</span>}
      </div>
      <Detalle m={m} />
    </>
  );
  return (
    <li className={cx("rounded-3xl bg-superficie ring-1 ring-linea", enlace ? "transition hover:ring-bosque" : "p-4")}>
      {enlace ? (
        <Link to={enlace} className="block rounded-3xl p-4 focus-visible:ring-2 focus-visible:ring-bosque focus-visible:outline-none">
          {contenido}
        </Link>
      ) : (
        contenido
      )}
      {acciones && <div className={cx("flex justify-end", enlace ? "px-4 pb-4" : "mt-3")}>{acciones}</div>}
    </li>
  );
};
