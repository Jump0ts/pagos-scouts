import { X } from "lucide-react";
import { useId } from "react";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import type { Articulo, LineaEntrada } from "./pedidos.types";
import { conEleccion, precioDe } from "./pedidos.utils";

type Props = {
  articulo: Articulo;
  linea: LineaEntrada;
  numero: number;
  error?: string | null;
  onCambiar: (linea: LineaEntrada) => void;
  onQuitar: () => void;
};

const suplemento = (centimos: number) => (centimos > 0 ? ` (+${euros(centimos)})` : "");

// Una unidad de un articulo con sus opciones: listas como botones y textos como campo con contador. La usan el
// formulario publico y el alta a mano de Tesoreria.
export const UnidadEditor = ({ articulo, linea, numero, error, onCambiar, onQuitar }: Props) => {
  const id = useId();
  return (
    <fieldset className={cx("flex flex-col gap-3 rounded-2xl bg-hundido p-3.5 ring-1", error ? "ring-rojo" : "ring-transparent")}>
      <legend className="sr-only">
        {articulo.nombre} {numero}
      </legend>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">
          {articulo.nombre} {numero > 1 || articulo.maxUnidades > 1 ? `#${numero}` : ""}
        </span>
        <span className="flex items-center gap-1">
          <span className="text-sm font-semibold tabular-nums">{euros(precioDe(articulo, linea))}</span>
          <button
            type="button"
            onClick={onQuitar}
            aria-label={`Quitar ${articulo.nombre} ${numero}`}
            className="grid size-9 place-items-center rounded-full text-suave hover:bg-superficie hover:text-rojo"
          >
            <X className="size-4" aria-hidden />
          </button>
        </span>
      </div>

      {articulo.opciones.map((o) => {
        const eleccion = linea.elecciones.find((e) => e.opcionId === o.id);
        const etiqueta = `${o.nombre}${o.obligatoria ? "" : " (opcional)"}`;
        if (o.tipo === "LISTA") {
          return (
            <div key={o.id} className="flex flex-col gap-1.5">
              <span id={`${id}-${o.id}`} className="text-sm text-suave">
                {etiqueta}
              </span>
              <div role="radiogroup" aria-labelledby={`${id}-${o.id}`} className="flex flex-wrap gap-1.5">
                {o.valores.map((v) => {
                  const elegido = eleccion?.valorId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={elegido}
                      onClick={() => onCambiar(conEleccion(linea, o.id, elegido && !o.obligatoria ? {} : { valorId: v.id }))}
                      className={cx(
                        "min-h-10 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                        elegido ? "bg-bosque text-fondo ring-bosque" : "bg-superficie ring-linea hover:ring-bosque",
                      )}
                    >
                      {v.valor}
                      {suplemento(v.suplementoCentimos)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        const texto = eleccion?.texto ?? "";
        return (
          <div key={o.id} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-${o.id}`} className="text-sm text-suave">
              {etiqueta}
              {suplemento(o.suplementoCentimos)}
            </label>
            <div className="relative">
              <input
                id={`${id}-${o.id}`}
                type="text"
                value={texto}
                maxLength={o.maxLongitud ?? undefined}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                onChange={(e) => onCambiar(conEleccion(linea, o.id, { texto: e.target.value }))}
                className="h-11 w-full rounded-xl bg-superficie pr-14 pl-3.5 text-base ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
              />
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs text-suave tabular-nums" aria-hidden>
                {texto.length}/{o.maxLongitud}
              </span>
            </div>
          </div>
        );
      })}

      {error && (
        <p role="alert" className="text-sm font-medium text-rojo">
          {error}
        </p>
      )}
    </fieldset>
  );
};
