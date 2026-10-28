import { cx } from "@/utils/cx";

// Barra de cobrado: lo pagado sobre lo debido.
export const BarraProgreso = ({ valor, total, etiqueta, className }: { valor: number; total: number; etiqueta: string; className?: string }) => {
  const porcentaje = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 100;
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
      className={cx("h-2.5 overflow-hidden rounded-full bg-hundido", className)}
    >
      <div className="h-full rounded-full bg-bosque transition-[width] duration-500" style={{ width: `${porcentaje}%` }} />
    </div>
  );
};
