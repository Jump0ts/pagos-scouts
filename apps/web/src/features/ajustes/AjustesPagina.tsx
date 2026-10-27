import { NavLink, Navigate, Outlet } from "react-router";
import { usePerfil } from "@/features/auth/useSesion";
import { cx } from "@/utils/cx";

const PESTANAS = [
  { a: "personas", texto: "Personas", soloAdmin: true },
  { a: "secciones", texto: "Secciones", soloAdmin: true },
  { a: "mi-cuenta", texto: "Mi cuenta", soloAdmin: false },
];

// D-24: Ajustes con pestañas; quien no administra el grupo solo ve "Mi cuenta".
export const AjustesPagina = () => {
  const { grupoActivo } = usePerfil();
  const esAdmin = grupoActivo?.rol === "ADMIN";
  const visibles = PESTANAS.filter((p) => esAdmin || !p.soloAdmin);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Ajustes</h1>
      <nav aria-label="Ajustes" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {visibles.map((p) => (
          <NavLink
            key={p.a}
            to={p.a}
            className={({ isActive }) =>
              cx(
                "shrink-0 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors",
                isActive ? "bg-tinta text-fondo ring-tinta" : "text-suave ring-linea hover:bg-hundido hover:text-tinta",
              )
            }
          >
            {p.texto}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
};

export const AjustesInicio = () => {
  const { grupoActivo } = usePerfil();
  return <Navigate to={grupoActivo?.rol === "ADMIN" ? "personas" : "mi-cuenta"} replace />;
};
