import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { BarraProgreso } from "@/components/BarraProgreso";
import { useSecciones } from "@/features/secciones/secciones.api";
import { FONDO_SECCION } from "@/features/secciones/secciones.constants";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { ETIQUETA_TIPO, rutaDeEvento } from "./eventos.constants";
import type { EventoConResumen } from "./eventos.types";

const fechaCorta = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

export const TarjetaEvento = ({ evento }: { evento: EventoConResumen }) => {
  const { data: secciones = [] } = useSecciones();
  const { resumen } = evento;
  const suyas = secciones.filter((s) => evento.precios.some((p) => p.seccionId === s.id));
  return (
    <Link
      to={rutaDeEvento(evento)}
      className="flex flex-col gap-3 rounded-3xl bg-superficie p-4 ring-1 ring-linea transition hover:ring-bosque md:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold">{evento.nombre}</p>
          <p className="text-sm text-suave">
            {ETIQUETA_TIPO[evento.tipo]} · {evento.cerrado ? "cerrado" : `hasta el ${fechaCorta(evento.fechaFin)}`}
          </p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-suave" aria-hidden />
      </div>
      <BarraProgreso valor={resumen.pagadoCentimos} total={resumen.debidoCentimos} etiqueta={`Cobrado de ${evento.nombre}`} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="tabular-nums">
          <strong>{euros(resumen.pagadoCentimos)}</strong> <span className="text-suave">de {euros(resumen.debidoCentimos)}</span>
        </span>
        <span className="text-suave tabular-nums">
          {resumen.alDia}/{resumen.ninos} {evento.tipo === "PEDIDO" ? "pagados" : "al día"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Secciones">
        {suyas.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-hundido px-2 py-0.5 text-xs font-semibold text-suave">
            <span className={cx("size-2 rounded-full", FONDO_SECCION[s.color])} aria-hidden /> {s.nombre}
          </span>
        ))}
      </div>
    </Link>
  );
};
