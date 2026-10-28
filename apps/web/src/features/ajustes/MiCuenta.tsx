import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { authApi } from "@/features/auth/auth.api";
import { ETIQUETA_ROL } from "@/features/auth/auth.constants";
import { cambiarContrasenaSchema, type CambiarContrasenaDatos } from "@/features/auth/auth.schema";
import { useCerrarSesion, usePerfil } from "@/features/auth/useSesion";
import { mostrarErroresDelServidor } from "@/utils/formularios";

export const MiCuenta = () => {
  const { usuario, grupos } = usePerfil();
  const cerrarSesion = useCerrarSesion();
  const [cambiada, setCambiada] = useState(false);
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<CambiarContrasenaDatos>({
    resolver: zodResolver(cambiarContrasenaSchema),
  });

  const cambiar = handleSubmit(async ({ actual, nueva }) => {
    setCambiada(false);
    try {
      await authApi.cambiarContrasena(actual, nueva);
      reset({ actual: "", nueva: "", repetir: "" });
      setCambiada(true);
    } catch (error) {
      mostrarErroresDelServidor(error, setError, ["actual", "nueva"]);
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <section aria-labelledby="titulo-cuenta" className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea md:p-6">
        <h2 id="titulo-cuenta" className="font-display text-xl font-bold">Tu cuenta</h2>
        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-suave">Nombre</dt>
            <dd className="font-semibold">{usuario.nombre}</dd>
          </div>
          <div>
            <dt className="text-suave">Email</dt>
            <dd className="font-semibold break-all">{usuario.email}</dd>
          </div>
          <div>
            <dt className="text-suave">Tus grupos</dt>
            <dd>
              <ul className="mt-1 flex flex-col gap-1">
                {grupos.map((g) => (
                  <li key={g.id} className="flex justify-between gap-3">
                    <span className="font-semibold">{g.nombre}</span>
                    <span className="text-suave">{ETIQUETA_ROL[g.rol]}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
        <Boton variante="secundario" className="mt-2 w-full sm:w-fit" cargando={cerrarSesion.isPending} onClick={() => cerrarSesion.mutate()}>
          <LogOut className="size-4" aria-hidden /> Cerrar sesión
        </Boton>
      </section>

      <section aria-labelledby="titulo-contrasena" className="rounded-3xl bg-superficie p-5 ring-1 ring-linea md:p-6">
        <h2 id="titulo-contrasena" className="font-display text-xl font-bold">Cambiar la contraseña</h2>
        <p className="mt-1 text-sm text-suave">Se cerrará tu sesión en los demás dispositivos.</p>
        <form onSubmit={cambiar} noValidate className="mt-5 flex flex-col gap-4">
          {cambiada && <Aviso tono="exito">Contraseña cambiada.</Aviso>}
          {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}
          <input type="email" value={usuario.email} autoComplete="username" readOnly hidden />
          <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" error={errors.actual?.message} {...register("actual")} />
          <Campo
            etiqueta="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            ayuda="Al menos 10 caracteres."
            error={errors.nueva?.message}
            {...register("nueva")}
          />
          <Campo etiqueta="Repite la contraseña nueva" type="password" autoComplete="new-password" error={errors.repetir?.message} {...register("repetir")} />
          <Boton type="submit" cargando={isSubmitting} className="sm:w-fit">Cambiar contraseña</Boton>
        </form>
      </section>
    </div>
  );
};
