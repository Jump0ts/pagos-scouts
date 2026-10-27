import { cx } from "@/utils/cx";

// Barra de progreso de un asistente: un tramo por paso, con su nombre debajo.
export const Pasos = ({ pasos, actual, etiqueta }: { pasos: string[]; actual: number; etiqueta: string }) => (
  <ol className="flex gap-2" aria-label={etiqueta}>
    {pasos.map((texto, i) => (
      <li key={texto} aria-current={i === actual ? "step" : undefined} className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className={cx("h-1.5 rounded-full", i <= actual ? "bg-bosque" : "bg-linea")} />
        <span className={cx("truncate text-xs font-semibold", i === actual ? "text-tinta" : "text-suave")}>
          {i + 1}. {texto}
        </span>
      </li>
    ))}
  </ol>
);
