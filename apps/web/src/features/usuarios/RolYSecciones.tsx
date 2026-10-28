import { Check } from "lucide-react";
import { ROLES } from "@/features/auth/auth.constants";
import type { Rol } from "@/features/auth/auth.types";
import { useSecciones } from "@/features/secciones/secciones.api";
import { FONDO_SECCION } from "@/features/secciones/secciones.constants";
import { cx } from "@/utils/cx";

type Props = {
  rol: Rol | undefined;
  onRol: (rol: Rol) => void;
  seccionIds: string[];
  onSecciones: (ids: string[]) => void;
  errorRol?: string;
  errorSecciones?: string;
};

// Eleccion de rol (tarjetas con su descripcion) y, para Scouter, de sus secciones. Se usa al invitar y al editar.
export const RolYSecciones = ({ rol, onRol, seccionIds, onSecciones, errorRol, errorSecciones }: Props) => {
  const { data: secciones = [] } = useSecciones();
  const activas = secciones.filter((s) => !s.archivada);

  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Rol</legend>
        <div role="radiogroup" aria-label="Rol" className="flex flex-col gap-2">
          {ROLES.map((r) => {
            const elegido = rol === r.valor;
            return (
              <button
                key={r.valor}
                type="button"
                role="radio"
                aria-checked={elegido}
                onClick={() => onRol(r.valor)}
                className={cx(
                  "flex items-start gap-3 rounded-2xl p-3 text-left ring-1 transition",
                  elegido ? "bg-bosque-claro ring-bosque" : "bg-hundido ring-transparent hover:ring-linea",
                )}
              >
                <span
                  className={cx(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1",
                    elegido ? "bg-bosque text-fondo ring-bosque" : "ring-suave/50",
                  )}
                >
                  {elegido && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{r.etiqueta}</span>
                  <span className="text-sm text-suave">{r.descripcion}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errorRol && <p className="mt-1.5 text-sm font-medium text-rojo">{errorRol}</p>}
      </fieldset>

      {rol === "SCOUTER" && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Secciones que puede consultar</legend>
          <div className="flex flex-wrap gap-2">
            {activas.map((s) => {
              const marcada = seccionIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => onSecciones(marcada ? seccionIds.filter((id) => id !== s.id) : [...seccionIds, s.id])}
                  className={cx(
                    "flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                    marcada ? "bg-bosque-claro text-bosque ring-bosque" : "bg-superficie text-suave ring-linea hover:text-tinta",
                  )}
                >
                  <span className={cx("size-2.5 rounded-full", FONDO_SECCION[s.color])} aria-hidden />
                  {s.nombre}
                  {marcada && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                </button>
              );
            })}
          </div>
          {errorSecciones && <p className="mt-1.5 text-sm font-medium text-rojo">{errorSecciones}</p>}
        </fieldset>
      )}
    </>
  );
};
