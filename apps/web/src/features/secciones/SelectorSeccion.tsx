import { Check } from "lucide-react";
import { cx } from "@/utils/cx";
import { useSecciones } from "./secciones.api";
import { FONDO_SECCION } from "./secciones.constants";

type Props = { valor: string | undefined; onCambiar: (seccionId: string) => void; error?: string; etiqueta?: string };

// Elegir UNA seccion (las archivadas no se ofrecen). Chips con el color de cada seccion.
export const SelectorSeccion = ({ valor, onCambiar, error, etiqueta = "Sección" }: Props) => {
  const { data: secciones = [] } = useSecciones();

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{etiqueta}</legend>
      <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-2">
        {secciones
          .filter((s) => !s.archivada || s.id === valor)
          .map((s) => {
            const elegida = valor === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={elegida}
                onClick={() => onCambiar(s.id)}
                className={cx(
                  "flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                  elegida ? "bg-bosque-claro text-bosque ring-bosque" : "bg-superficie text-suave ring-linea hover:text-tinta",
                )}
              >
                <span className={cx("size-2.5 rounded-full", FONDO_SECCION[s.color])} aria-hidden />
                {s.nombre}
                {elegida && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              </button>
            );
          })}
      </div>
      {error && <p className="mt-1.5 text-sm font-medium text-rojo">{error}</p>}
    </fieldset>
  );
};
