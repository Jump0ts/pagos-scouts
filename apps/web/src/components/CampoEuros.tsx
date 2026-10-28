import { useId, type ComponentProps } from "react";
import { cx } from "@/utils/cx";

type Props = Omit<ComponentProps<"input">, "type"> & { etiqueta: string; etiquetaVisible?: boolean; error?: string };

// Campo de importe en euros (texto libre: "85", "85,50"); quien lo usa lo convierte con aCentimos.
export const CampoEuros = ({ etiqueta, etiquetaVisible = true, error, id, className, ...props }: Props) => {
  const generado = useId();
  const campoId = id ?? generado;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={campoId} className={etiquetaVisible ? "text-sm font-semibold" : "sr-only"}>
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={campoId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${campoId}-error` : undefined}
          className={cx(
            "h-12 w-full rounded-2xl bg-superficie pr-9 pl-4 text-right text-base tabular-nums ring-1 focus:outline-none focus:ring-2 disabled:bg-hundido disabled:text-suave",
            error ? "ring-rojo focus:ring-rojo" : "ring-linea focus:ring-bosque",
          )}
          {...props}
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-suave" aria-hidden>
          €
        </span>
      </div>
      {error && (
        <p id={`${campoId}-error`} className="text-sm font-medium text-rojo">
          {error}
        </p>
      )}
    </div>
  );
};
