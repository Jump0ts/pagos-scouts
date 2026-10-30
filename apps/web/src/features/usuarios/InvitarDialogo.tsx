import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Dialogo } from "@/components/Dialogo";
import { EnlaceCompartible } from "@/components/EnlaceCompartible";
import { usePerfil } from "@/features/auth/useSesion";
import { mostrarErroresDelServidor } from "@/utils/formularios";
import { useInvitar } from "./usuarios.api";
import { RolYSecciones } from "./RolYSecciones";

const esquema = z
  .object({
    email: z.string().trim().min(1, "Escribe su email").email("No es un email válido"),
    rol: z.enum(["ADMIN", "TESORERIA", "SCOUTER"], { error: "Elige un rol" }),
    seccionIds: z.array(z.string()),
  })
  .refine((d) => d.rol !== "SCOUTER" || d.seccionIds.length > 0, {
    path: ["seccionIds"],
    message: "Elige al menos una sección",
  });
type Datos = z.infer<typeof esquema>;

// D-15 + D-25: se crea la invitacion y en el mismo dialogo aparece el enlace para copiar o compartir.
export const InvitarDialogo = ({ abierto, onCambiar }: { abierto: boolean; onCambiar: (v: boolean) => void }) => {
  const { grupoActivo } = usePerfil();
  const invitar = useInvitar();
  const [enlace, setEnlace] = useState<{ url: string; email: string } | null>(null);
  const { register, control, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { email: "", seccionIds: [] },
  });

  useEffect(() => {
    if (abierto) {
      reset({ email: "", seccionIds: [] });
      setEnlace(null);
    }
  }, [abierto, reset]);

  const enviar = handleSubmit(async (datos) => {
    try {
      const res = await invitar.mutateAsync(datos);
      setEnlace({ url: res.enlace, email: res.invitacion.email });
    } catch (error) {
      mostrarErroresDelServidor(error, setError, ["email", "rol", "seccionIds"]);
    }
  });

  if (enlace) {
    return (
      <Dialogo
        abierto={abierto}
        onCambiar={onCambiar}
        titulo="Invitación creada"
        descripcion={`Envíale este enlace a ${enlace.email}. Con él elegirá su contraseña y entrará en el grupo.`}
      >
        <EnlaceCompartible
          enlace={enlace.url}
          mensaje={`Te invito a la tesorería de ${grupoActivo?.nombre ?? "nuestro grupo"}. Entra con este enlace (caduca en 7 días):`}
          caducidad="Caduca en 7 días y solo se puede usar una vez."
        />
        <Boton variante="fantasma" className="mt-3 w-full" onClick={() => onCambiar(false)}>Hecho</Boton>
      </Dialogo>
    );
  }

  return (
    <Dialogo
      abierto={abierto}
      onCambiar={onCambiar}
      titulo="Invitar a alguien"
      descripcion="Se crea un enlace que le envías tú. La app no manda correos."
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
        {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}
        <Campo etiqueta="Email" type="email" inputMode="email" autoComplete="off" autoFocus error={errors.email?.message} {...register("email")} />
        <Controller
          control={control}
          name="rol"
          render={({ field: rol }) => (
            <Controller
              control={control}
              name="seccionIds"
              render={({ field: secciones }) => (
                <RolYSecciones
                  rol={rol.value}
                  onRol={rol.onChange}
                  seccionIds={secciones.value}
                  onSecciones={secciones.onChange}
                  errorRol={errors.rol?.message}
                  errorSecciones={errors.seccionIds?.message}
                />
              )}
            />
          )}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={() => onCambiar(false)}>Cancelar</Boton>
          <Boton type="submit" cargando={isSubmitting}>Crear invitación</Boton>
        </div>
      </form>
    </Dialogo>
  );
};
