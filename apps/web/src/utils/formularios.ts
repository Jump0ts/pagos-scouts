import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError, mensajeDeError } from "./api";

// Lleva los errores de la API a su campo del formulario; lo que no es de un campo va arriba del formulario.
export const mostrarErroresDelServidor = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  camposDelFormulario: readonly Path<T>[],
) => {
  let alguno = false;
  if (error instanceof ApiError && error.campos) {
    for (const [campo, mensaje] of Object.entries(error.campos)) {
      if ((camposDelFormulario as readonly string[]).includes(campo)) {
        setError(campo as Path<T>, { type: "server", message: mensaje });
        alguno = true;
      }
    }
  }
  if (!alguno) setError("root.servidor" as Path<T>, { type: "server", message: mensajeDeError(error) });
};
