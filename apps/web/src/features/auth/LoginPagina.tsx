import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { mostrarErroresDelServidor } from "@/utils/formularios";
import { authApi } from "./auth.api";
import { loginSchema, type LoginDatos } from "./auth.schema";
import { PantallaAcceso } from "./PantallaAcceso";
import { useEstablecerSesion, useSesion } from "./useSesion";

export const LoginPagina = () => {
  const { data: sesion } = useSesion();
  const establecer = useEstablecerSesion();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = (location.state as { desde?: string } | null)?.desde ?? "/";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginDatos>({ resolver: zodResolver(loginSchema) });

  if (sesion) return <Navigate to={destino} replace />;

  const entrar = handleSubmit(async ({ email, contrasena }) => {
    try {
      establecer(await authApi.login(email, contrasena));
      navigate(destino, { replace: true });
    } catch (error) {
      mostrarErroresDelServidor(error, setError, ["email", "contrasena"]);
    }
  });

  return (
    <PantallaAcceso
      titulo="Entrar"
      subtitulo="Con el email y la contraseña de tu cuenta."
      pie="¿Has olvidado la contraseña? Pide a un administrador de tu grupo un enlace para elegir otra."
    >
      <form onSubmit={entrar} noValidate className="flex flex-col gap-4">
        {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}
        <Campo
          etiqueta="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          error={errors.email?.message}
          {...register("email")}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.contrasena?.message}
          {...register("contrasena")}
        />
        <Boton type="submit" cargando={isSubmitting} className="mt-2">
          Entrar
        </Boton>
      </form>
    </PantallaAcceso>
  );
};
