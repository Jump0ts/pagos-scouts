import * as Menu from "@radix-ui/react-dropdown-menu";
import { CalendarDays, House, Landmark, LogOut, Settings, Tent, UserRound, Users } from "lucide-react";
import type { Rol } from "@/features/auth/auth.types";
import { Link, NavLink, Outlet } from "react-router";
import { useCerrarSesion, usePerfil } from "@/features/auth/useSesion";
import { SelectorGrupo } from "@/features/grupos/SelectorGrupo";
import { SinGrupo } from "@/features/grupos/SinGrupo";
import { cx } from "@/utils/cx";

// roles: quien ve la entrada (sin roles, todos). Los movimientos del banco no los ve un scouter (D-16).
const NAVEGACION: { a: string; texto: string; icono: typeof House; fin: boolean; roles?: Rol[] }[] = [
  { a: "/", texto: "Inicio", icono: House, fin: true },
  { a: "/eventos", texto: "Eventos", icono: CalendarDays, fin: false },
  { a: "/movimientos", texto: "Movimientos", icono: Landmark, fin: false, roles: ["ADMIN", "TESORERIA"] },
  { a: "/educandos", texto: "Educandos", icono: Users, fin: false },
  { a: "/ajustes", texto: "Ajustes", icono: Settings, fin: false },
];

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export const AppLayout = () => {
  const { usuario, grupoActivo } = usePerfil();
  const cerrarSesion = useCerrarSesion();
  const entradas = NAVEGACION.filter((e) => !e.roles || (grupoActivo && e.roles.includes(grupoActivo.rol)));

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header
        className="sticky z-20 border-b border-linea bg-fondo/85 backdrop-blur"
        style={{ top: "env(safe-area-inset-top, 0px)", paddingInline: "max(16px, env(safe-area-inset-left))" }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link to="/" aria-label="Inicio" className="grid size-9 shrink-0 place-items-center rounded-xl bg-bosque text-fondo">
              <Tent className="size-5" aria-hidden />
            </Link>
            <div className="min-w-0 leading-tight">
              <span className="block font-display text-lg font-bold">Tesorería</span>
              <SelectorGrupo />
            </div>
          </div>

          <nav aria-label="Principal" className="ml-2 hidden gap-1 md:flex">
            {entradas.map(({ a, texto, icono: Icono, fin }) => (
              <NavLink
                key={a}
                to={a}
                end={fin}
                className={({ isActive }) =>
                  cx(
                    "flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    isActive ? "bg-tinta text-fondo" : "text-suave hover:bg-hundido hover:text-tinta",
                  )
                }
              >
                <Icono className="size-4" aria-hidden /> {texto}
              </NavLink>
            ))}
          </nav>

          <Menu.Root>
            <Menu.Trigger
              aria-label={`Tu cuenta: ${usuario.nombre}`}
              className="ml-auto grid size-10 shrink-0 place-items-center rounded-full bg-bosque-claro text-sm font-bold text-bosque ring-1 ring-linea"
            >
              {iniciales(usuario.nombre)}
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={8} className="z-50 min-w-60 rounded-2xl bg-superficie p-1.5 shadow-xl ring-1 ring-linea">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">{usuario.nombre}</p>
                  <p className="truncate text-xs text-suave">{usuario.email}</p>
                </div>
                <Menu.Separator className="my-1 h-px bg-linea" />
                <Menu.Item asChild>
                  <Link
                    to="/ajustes/mi-cuenta"
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hundido"
                  >
                    <UserRound className="size-4 text-suave" aria-hidden /> Mi cuenta
                  </Link>
                </Menu.Item>
                <Menu.Item
                  onSelect={() => cerrarSesion.mutate()}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hundido"
                >
                  <LogOut className="size-4 text-suave" aria-hidden /> Cerrar sesión
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>

      <main className="mx-auto max-w-6xl pt-6" style={{ paddingInline: "max(16px, env(safe-area-inset-left))" }}>
        {grupoActivo ? <Outlet /> : <SinGrupo />}
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-linea bg-superficie/95 pt-2 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        {entradas.map(({ a, texto, icono: Icono, fin }) => (
          <NavLink
            key={a}
            to={a}
            end={fin}
            className={({ isActive }) =>
              cx("flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 text-[11px] font-semibold", isActive ? "text-bosque" : "text-suave")
            }
          >
            {({ isActive }) => (
              <>
                <span className={cx("grid h-7 w-12 place-items-center rounded-full", isActive && "bg-bosque-claro")}>
                  <Icono className="size-5" aria-hidden />
                </span>
                {texto}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
