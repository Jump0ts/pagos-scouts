import { Navigate, Outlet, useLocation } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { mensajeDeError } from "@/utils/api";
import type { Rol } from "./auth.types";
import { usePerfil, useSesion } from "./useSesion";

// Sin sesion, a /login (y de vuelta aqui despues de entrar).
export const RutaProtegida = () => {
  const { data, isPending, error } = useSesion();
  const location = useLocation();

  if (isPending) return <Cargando />;
  if (error) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Aviso tono="error">{mensajeDeError(error)}</Aviso>
      </div>
    );
  }
  if (!data) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  return <Outlet />;
};

// Solo para ciertos roles del grupo activo; al resto se le lleva al inicio. La API lo comprueba igualmente.
export const SoloRol = ({ roles }: { roles: Rol[] }) => {
  const perfil = usePerfil();
  return perfil.grupoActivo && roles.includes(perfil.grupoActivo.rol) ? <Outlet /> : <Navigate to="/" replace />;
};
