import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Dialogo } from "@/components/Dialogo";
import { cx } from "@/utils/cx";
import { mostrarErroresDelServidor } from "@/utils/formularios";
import { useCrearSeccion, useEditarSeccion } from "./secciones.api";
import { COLORES_SECCION } from "./secciones.constants";
import type { ColorSeccion, Seccion } from "./secciones.types";

const esquema = z.object({
  nombre: z.string().trim().min(2, "El nombre es demasiado corto").max(40, "El nombre es demasiado largo"),
  color: z.enum(["castores", "manada", "tropa", "unidad", "clan", "scouters"]),
});
type Datos = z.infer<typeof esquema>;

type Props = { abierto: boolean; onCambiar: (abierto: boolean) => void; seccion?: Seccion };

// Crear una seccion nueva o renombrar / cambiar el color de una existente.
export const SeccionDialogo = ({ abierto, onCambiar, seccion }: Props) => {
  const crear = useCrearSeccion();
  const editar = useEditarSeccion();
  const { register, control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Datos>({
    resolver: zodResolver(esquema),
  });

  useEffect(() => {
    if (abierto) reset({ nombre: seccion?.nombre ?? "", color: seccion?.color ?? "tropa" });
  }, [abierto, seccion, reset]);

  const guardar = handleSubmit(async (datos) => {
    try {
      if (seccion) await editar.mutateAsync({ id: seccion.id, ...datos });
      else await crear.mutateAsync(datos);
      onCambiar(false);
    } catch (error) {
      mostrarErroresDelServidor(error, setError, ["nombre", "color"]);
    }
  });

  return (
    <Dialogo abierto={abierto} onCambiar={onCambiar} titulo={seccion ? `Editar ${seccion.nombre}` : "Nueva sección"}>
      <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
        {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}
        <Campo etiqueta="Nombre" autoFocus error={errors.nombre?.message} {...register("nombre")} />
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Color</legend>
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Color" className="flex flex-wrap gap-2">
                {COLORES_SECCION.map((color) => {
                  const elegido = field.value === color.valor;
                  return (
                    <button
                      key={color.valor}
                      type="button"
                      role="radio"
                      aria-checked={elegido}
                      aria-label={color.etiqueta}
                      onClick={() => field.onChange(color.valor as ColorSeccion)}
                      className={cx(
                        "grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-superficie transition",
                        color.fondo,
                        elegido ? "ring-2 ring-tinta" : "hover:scale-105",
                      )}
                    >
                      {elegido && <Check className="size-5 text-white" strokeWidth={3} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </fieldset>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={() => onCambiar(false)}>Cancelar</Boton>
          <Boton type="submit" cargando={isSubmitting}>{seccion ? "Guardar" : "Crear sección"}</Boton>
        </div>
      </form>
    </Dialogo>
  );
};
