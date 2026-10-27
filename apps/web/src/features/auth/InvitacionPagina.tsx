import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Cargando } from "@/components/Cargando";
import { mensajeDeError } from "@/utils/api";
import { mostrarErroresDelServidor } from "@/utils/formularios";
import { authApi } from "./auth.api";
import { ETIQUETA_ROL } from "./auth.constants";
import {
  cuentaExistenteSchema,
  cuentaNuevaSchema,
  type CuentaExistenteDatos,
  type CuentaNuevaDatos,
} from "./auth.schema";
import type { InfoInvitacion } from "./auth.types";
import { PantallaAcceso } from "./PantallaAcceso";
import { useEstablecerSesion } from "./useSesion";

// D-15: quien abre el enlace crea su cuenta (o usa la que ya tiene) y entra directamente en el grupo.
export const InvitacionPagina = () => {
  const { token = "" } = useParams();
  const { data, isPending, error } = useQuery({
    queryKey: ["invitacion", token],
    queryFn: () => authApi.verInvitacion(token),
    retry: false,
  });

  if (isPending) return <Cargando />;
  if (error || !data) {
    return (
      <PantallaAcceso titulo="Invitación no válida" pie={<Link to="/login" className="font-semibold text-bosque">Ir a entrar</Link>}>
        <Aviso tono="error">{mensajeDeError(error)}</Aviso>
        <p className="mt-4 text-sm text-suave">Pide a quien te invitó que genere un enlace nuevo.</p>
      </PantallaAcceso>
    );
  }

  return (
    <PantallaAcceso
      titulo={`Únete a ${data.grupo.nombre}`}
      subtitulo={
        <>
          Te han invitado como <strong className="text-tinta">{ETIQUETA_ROL[data.rol]}</strong> con el email{" "}
          <strong className="text-tinta">{data.email}</strong>.
        </>
      }
    >
      {data.usuarioExiste ? <ConCuenta token={token} info={data} /> : <SinCuenta token={token} info={data} />}
    </PantallaAcceso>
  );
};

const useAlAceptar = () => {
  const establecer = useEstablecerSesion();
  const navigate = useNavigate();
  return (perfil: Awaited<ReturnType<typeof authApi.aceptarInvitacion>>) => {
    establecer(perfil);
    navigate("/", { replace: true });
  };
};

const SinCuenta = ({ token, info }: { token: string; info: InfoInvitacion }) => {
  const alAceptar = useAlAceptar();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CuentaNuevaDatos>({
    resolver: zodResolver(cuentaNuevaSchema),
  });

  const aceptar = handleSubmit(async ({ nombre, contrasena }) => {
    try {
      alAceptar(await authApi.aceptarInvitacion(token, { nombre, contrasena }));
    } catch (error) {
      mostrarErroresDelServidor(error, setError, ["nombre", "contrasena"]);
    }
  });

  return (
    <form onSubmit={aceptar} noValidate className="flex flex-col gap-4">
      {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}
      <input type="email" value={info.email} autoComplete="username" readOnly hidden />
      <Campo etiqueta="Tu nombre" autoComplete="name" autoFocus error={errors.nombre?.message} {...register("nombre")} />
      <Campo
        etiqueta="Elige una contraseña"
        type="password"
        autoComplete="new-password"
        ayuda="Al menos 10 caracteres. Mejor una frase que una palabra rara."
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
        Crear cuenta y entrar
      </Boton>
    </form>
  );
};

const ConCuenta = ({ token, info }: { token: string; info: InfoInvitacion }) => {
  const alAceptar = useAlAceptar();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CuentaExistenteDatos>({
    resolver: zodResolver(cuentaExistenteSchema),
  });

  const aceptar = handleSubmit(async ({ contrasena }) => {
    try {
      alAceptar(await authApi.aceptarInvitacion(token, { contrasena }));
    } catch (error) {
      mostrarErroresDelServidor(error, setError, ["contrasena"]);
    }
  });

  return (
    <form onSubmit={aceptar} noValidate className="flex flex-col gap-4">
      <Aviso tono="info">Ya tienes cuenta en la tesorería. Escribe tu contraseña para añadir este grupo.</Aviso>
      {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}
      <input type="email" value={info.email} autoComplete="username" readOnly hidden />
      <Campo
        etiqueta="Tu contraseña"
        type="password"
        autoComplete="current-password"
        autoFocus
        error={errors.contrasena?.message}
        {...register("contrasena")}
      />
      <Boton type="submit" cargando={isSubmitting} className="mt-2">
        Unirme al grupo
      </Boton>
    </form>
  );
};
