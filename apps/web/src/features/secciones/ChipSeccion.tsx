import { cx } from "@/utils/cx";
import { FONDO_SECCION } from "./secciones.constants";
import type { Seccion } from "./secciones.types";

export const ChipSeccion = ({ seccion }: { seccion: Pick<Seccion, "nombre" | "color"> }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-hundido px-2.5 py-0.5 text-xs font-semibold text-suave">
    <span className={cx("size-2 rounded-full", FONDO_SECCION[seccion.color])} aria-hidden /> {seccion.nombre}
  </span>
);
