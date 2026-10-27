import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { MOTIVOS } from "./movimientos.constants";
import type { CargoDeMovimiento, Movimiento, MovimientoPrevisto } from "./movimientos.types";

const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

const Chip = ({ clase, children }: { clase: string; children: ReactNode }) => (
  <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", clase)}>{children}</span>
);

const AMBAR = "bg-ambar-claro text-[color-mix(in_oklch,var(--color-ambar)_65%,var(--color-tinta))]";

// "Cuota de Sara (110 €), Censo de Mateo (30 €)"
const textoCargos = (cargos: CargoDeMovimiento[]) =>
  cargos.map((c) => `${c.evento} de ${c.educando} (${euros(c.importeCentimos)})`).join(", ");

const quienClasifico = (m: Movimiento | MovimientoPrevisto) => {
  if (!("origen" in m)) return <Chip clase="bg-bosque-claro text-bosque">Se clasifica solo</Chip>;
  if (m.origen === "LISTADO") return <Chip clase="bg-azul-claro text-azul">Marcado en el listado</Chip>;
  return m.clasificadoPor ? (
    <Chip clase="bg-azul-claro text-azul">Por {m.clasificadoPor.split(/\s+/)[0]}</Chip>
  ) : (
    <Chip clase="bg-bosque-claro text-bosque">Automático</Chip>
  );
};

// Un ingreso como en la maqueta: quien paga y el importe arriba; debajo, el estado y a qué se atribuye.
export const FilaMovimiento = ({ movimiento: m, acciones }: { movimiento: Movimiento | MovimientoPrevisto; acciones?: ReactNode }) => {
  const motivo = m.motivo ? MOTIVOS[m.motivo] : null;
  return (
    <li className="rounded-3xl bg-superficie p-4 ring-1 ring-linea">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-semibold">{m.concepto}</p>
        <p className="font-display text-lg font-bold tabular-nums">{euros(m.importeCentimos)}</p>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {motivo ? (
          <Chip clase={m.motivo === "PAGADOR_DESCONOCIDO" ? "bg-rojo-claro text-rojo" : AMBAR}>{motivo.etiqueta}</Chip>
        ) : (
          quienClasifico(m)
        )}
        {m.fecha && <span className="text-xs text-suave tabular-nums">{fechaCorta(m.fecha)}</span>}
      </div>

      {m.estado === "CLASIFICADO" ? (
        <p className="mt-3 text-sm">
          <strong>{m.familia?.nombre}</strong>
          {m.cargos.length > 0 && <span className="text-suave"> · {textoCargos(m.cargos)}</span>}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-1 text-sm">
          {motivo && <p className="text-suave">{motivo.explicacion}</p>}
          {m.familia && (
            <p>
              Sugerencia: <strong>{m.familia.nombre}</strong>
              {m.cargos.length > 0 && <span className="text-suave"> · {textoCargos(m.cargos)}</span>}
            </p>
          )}
        </div>
      )}
      {acciones && <div className="mt-3 flex justify-end">{acciones}</div>}
    </li>
  );
};
