import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cx } from "@/utils/cx";

const VARIANTES = {
  primario: "bg-bosque text-fondo hover:brightness-110",
  secundario: "bg-superficie text-tinta ring-1 ring-linea hover:bg-hundido",
  fantasma: "text-suave hover:bg-hundido hover:text-tinta",
  peligro: "bg-rojo text-fondo hover:brightness-110",
} as const;

const TAMANOS = {
  normal: "h-12 px-5 text-sm",
  pequeno: "h-9 px-3.5 text-sm",
} as const;

type Props = ComponentProps<"button"> & {
  variante?: keyof typeof VARIANTES;
  tamano?: keyof typeof TAMANOS;
  cargando?: boolean;
};

export const Boton = ({
  variante = "primario",
  tamano = "normal",
  cargando = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: Props) => (
  <button
    type={type}
    disabled={disabled || cargando}
    aria-busy={cargando || undefined}
    className={cx(
      "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
      VARIANTES[variante],
      TAMANOS[tamano],
      className,
    )}
    {...props}
  >
    {cargando && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
    {children}
  </button>
);
