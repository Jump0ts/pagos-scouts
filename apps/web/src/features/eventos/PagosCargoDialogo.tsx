import { Landmark, ListChecks, Wallet } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { Dialogo } from "@/components/Dialogo";
import { ETIQUETA_MEDIO } from "@/features/movimientos/movimientos.constants";
import { mensajeDeError } from "@/utils/api";
import { euros } from "@/utils/dinero";
import { usePagosDeCargo } from "./eventos.api";
import type { CargoVista, PagoDeCargo } from "./eventos.types";

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

const ORIGEN = {
  BANCO: { icono: Landmark, texto: () => "Banco" },
  MANUAL: { icono: Wallet, texto: (p: PagoDeCargo) => `A mano${p.medio ? ` · ${ETIQUETA_MEDIO[p.medio]}` : ""}` },
  LISTADO: { icono: ListChecks, texto: () => "Marcado en el listado" },
} as const;

type Props = { eventoId: string; evento: string; cargo: CargoVista | null; onCerrar: () => void };

// D-56: qué pagos cubren el cargo de un niño. Solo Admin y Tesorería.
export const PagosCargoDialogo = ({ eventoId, evento, cargo, onCerrar }: Props) => {
  const { data, isPending, error } = usePagosDeCargo(eventoId, cargo?.id ?? null);
  const pendiente = cargo ? Math.max(0, cargo.importeCentimos - cargo.pagadoCentimos) : 0;

  return (
    <Dialogo
      abierto={cargo !== null}
      onCambiar={(v) => !v && onCerrar()}
      titulo={cargo ? `${cargo.educando.nombre} ${cargo.educando.apellidos}`.trim() : ""}
      descripcion={cargo ? `${evento} · ${euros(cargo.pagadoCentimos)} pagado de ${euros(cargo.importeCentimos)}${pendiente ? ` · faltan ${euros(pendiente)}` : ""}` : undefined}
    >
      {isPending ? (
        <Cargando />
      ) : error || !data ? (
        <Aviso tono="error">{mensajeDeError(error)}</Aviso>
      ) : data.pagos.length === 0 ? (
        <p className="rounded-2xl bg-hundido p-4 text-center text-sm text-suave">Aún no hay ningún pago para este evento.</p>
      ) : (
        <ul className="divide-y divide-linea overflow-hidden rounded-2xl ring-1 ring-linea">
          {data.pagos.map((p) => {
            const { icono: Icono, texto } = ORIGEN[p.origen];
            return (
              <li key={p.movimientoId} className="flex items-start gap-3 p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-hundido text-suave">
                  <Icono className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.concepto}</span>
                  <span className="block text-xs text-suave">
                    {texto(p)}
                    {p.fecha && ` · ${fechaLarga(p.fecha)}`}
                  </span>
                  {p.cruce && (
                    <span className="mt-0.5 block text-xs text-suave">
                      Es el mismo dinero que {p.cruce.origen === "LISTADO" ? "la marca del listado" : "el pago apuntado a mano"}.
                    </span>
                  )}
                </span>
                <span className="font-semibold tabular-nums">{euros(p.importeCentimos)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialogo>
  );
};
