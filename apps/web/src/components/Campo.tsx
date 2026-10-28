import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";
import { cx } from "@/utils/cx";

type Props = ComponentProps<"input"> & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
};

// Campo de formulario con su etiqueta, su ayuda y su error enlazados para los lectores de pantalla.
export const Campo = ({ etiqueta, error, ayuda, id, className, type = "text", ...props }: Props) => {
  const generado = useId();
  const campoId = id ?? generado;
  const [visible, setVisible] = useState(false);
  const esContrasena = type === "password";
  const descritoPor = [ayuda && `${campoId}-ayuda`, error && `${campoId}-error`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={campoId} className="text-sm font-semibold">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={campoId}
          type={esContrasena && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={descritoPor}
          className={cx(
            "h-12 w-full rounded-2xl bg-superficie px-4 text-base ring-1 transition placeholder:text-suave focus:outline-none focus:ring-2",
            error ? "ring-rojo focus:ring-rojo" : "ring-linea focus:ring-bosque",
            esContrasena && "pr-12",
          )}
          {...props}
        />
        {esContrasena && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      {ayuda && !error && (
        <p id={`${campoId}-ayuda`} className="text-sm text-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${campoId}-error`} className="text-sm font-medium text-rojo">
          {error}
        </p>
      )}
    </div>
  );
};
