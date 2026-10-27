import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Cargando } from "@/components/Cargando";
import { mensajeDeError } from "@/utils/api";
import { mostrarErroresDelServidor } from "@/utils/formularios";
import { authApi } from "./auth.api";
import { nuevaContrasenaSchema, type NuevaContrasenaDatos } from "./auth.schema";
import { PantallaAcceso } from "./PantallaAcceso";

// D-21: enlace generado por un administrador para elegir una contraseña nueva.
export const RestablecerPagina = () => {
  const { token = "" } = useParams();
  const [hecho, setHecho] = useState(false);
  const { data, isPending, error } = useQuery({
    queryKey: ["restablecer", token],
    queryFn: () => authApi.verRestablecimiento(token),
    retry: false,
    enabled: !hecho,
  });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<NuevaContrasenaDatos>({
    resolver: zodResolver(nuevaContrasenaSchema),
  });

  const irAEntrar = <Link to="/login" className="font-semibold text-bosque">Ir a entrar</Link>;

  if (hecho) {
    return (
      <PantallaAcceso titulo="Contraseña cambiada" pie={irAEntrar}>
        <Aviso tono="exito">Ya puedes entrar con tu contraseña nueva. Las sesiones que tenías abiertas se han cerrado.</Aviso>
      </PantallaAcceso>
    );
  }
  if (isPending) return <Cargando />;
  if (error || !data) {
    return (
      <PantallaAcceso titulo="Enlace no válido" pie={irAEntrar}>
        <Aviso tono="error">{mensajeDeError(error)}</Aviso>
        <p className="mt-4 text-sm text-suave">Pide a un administrador de tu grupo un enlace nuevo.</p>
      </PantallaAcceso>
    );
  }

  const guardar = handleSubmit(async ({ contrasena }) => {
    try {
      await authApi.restablecer(token, contrasena);
      setHecho(true);
    } catch (e) {
      mostrarErroresDelServidor(e, setError, ["contrasena"]);
    }
  });

  return (
    <PantallaAcceso titulo="Elige una contraseña nueva" subtitulo={<>Para <strong className="text-tinta">{data.email}</strong>.</>}>
      <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
        {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}
        <input type="email" value={data.email} autoComplete="username" readOnly hidden />
        <Campo
          etiqueta="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          autoFocus
          ayuda="Al menos 10 caracteres."
          error={errors.contrasena?.message}
          {...register("contrasena")}
        />
        <Campo
          etiqueta="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.repetir?.message}
          {...register("repetir")}
        />
        <Boton type="submit" cargando={isSubmitting} className="mt-2">
          Guardar contraseña
        </Boton>
      </form>
    </PantallaAcceso>
  );
};
