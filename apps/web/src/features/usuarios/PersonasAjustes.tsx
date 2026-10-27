import * as Menu from "@radix-ui/react-dropdown-menu";
import { Ellipsis, KeyRound, Mail, Plus, ShieldCheck, Trash2, UserMinus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { Confirmar } from "@/components/Confirmar";
import { Dialogo } from "@/components/Dialogo";
import { EnlaceCompartible } from "@/components/EnlaceCompartible";
import { ETIQUETA_ROL } from "@/features/auth/auth.constants";
import { usePerfil } from "@/features/auth/useSesion";
import { ChipSeccion } from "@/features/secciones/ChipSeccion";
import { useSecciones } from "@/features/secciones/secciones.api";
import { mensajeDeError } from "@/utils/api";
import { tiempoHasta } from "@/utils/fechas";
import { EditarMiembroDialogo } from "./EditarMiembroDialogo";
import { InvitarDialogo } from "./InvitarDialogo";
import { useEnlaceRestablecer, useQuitarMiembro, useRetirarInvitacion, useUsuarios } from "./usuarios.api";
import type { InvitacionPendiente, Miembro } from "./usuarios.types";

const claseItem = "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hundido";

const MenuAcciones = ({ etiqueta, children }: { etiqueta: string; children: ReactNode }) => (
  <Menu.Root>
    <Menu.Trigger
      aria-label={etiqueta}
      className="grid size-10 shrink-0 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
    >
      <Ellipsis className="size-5" aria-hidden />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content align="end" sideOffset={6} className="z-50 min-w-64 rounded-2xl bg-superficie p-1.5 shadow-xl ring-1 ring-linea">
        {children}
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>
);

export const PersonasAjustes = () => {
  const { grupoActivo } = usePerfil();
  const { data, isPending, error } = useUsuarios();
  const { data: secciones = [] } = useSecciones();
  const quitar = useQuitarMiembro();
  const retirar = useRetirarInvitacion();
  const restablecer = useEnlaceRestablecer();

  const [invitando, setInvitando] = useState(false);
  const [editando, setEditando] = useState<Miembro | null>(null);
  const [quitando, setQuitando] = useState<Miembro | null>(null);
  const [retirando, setRetirando] = useState<InvitacionPendiente | null>(null);
  const [enlaceDe, setEnlaceDe] = useState<{ miembro: Miembro; enlace: string } | null>(null);

  if (isPending) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  const chips = (ids: string[]) =>
    secciones.filter((s) => ids.includes(s.id)).map((s) => <ChipSeccion key={s.id} seccion={s} />);

  const generarEnlace = async (miembro: Miembro) => {
    const res = await restablecer.mutateAsync(miembro.membresiaId);
    setEnlaceDe({ miembro, enlace: res.enlace });
  };

  return (
    <section aria-labelledby="titulo-personas" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-personas" className="font-display text-xl font-bold">Personas</h2>
          <p className="text-sm text-suave">Quién entra en la tesorería de {grupoActivo?.nombre} y qué puede hacer.</p>
        </div>
        <Boton tamano="pequeno" onClick={() => setInvitando(true)}>
          <Plus className="size-4" aria-hidden /> Invitar
        </Boton>
      </div>

      {restablecer.error && <Aviso tono="error">{mensajeDeError(restablecer.error)}</Aviso>}

      <ul className="divide-y divide-linea overflow-hidden rounded-3xl bg-superficie ring-1 ring-linea">
        {data.miembros.map((m) => (
          <li key={m.membresiaId} className="flex items-center gap-3 py-3 pr-2 pl-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-hundido text-sm font-bold text-suave" aria-hidden>
              {m.usuario.nombre.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="truncate font-semibold">{m.usuario.nombre}</span>
                {m.esTuCuenta && <span className="text-xs font-semibold text-bosque">Tú</span>}
              </span>
              <span className="block truncate text-sm text-suave">{m.usuario.email}</span>
              <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-tinta px-2.5 py-0.5 text-xs font-semibold text-fondo">{ETIQUETA_ROL[m.rol]}</span>
                {chips(m.seccionIds)}
              </span>
            </span>
            <MenuAcciones etiqueta={`Acciones para ${m.usuario.nombre}`}>
              <Menu.Item className={claseItem} onSelect={() => setEditando(m)}>
                <ShieldCheck className="size-4 text-suave" aria-hidden /> Cambiar rol
              </Menu.Item>
              {!m.esTuCuenta && (
                <Menu.Item className={claseItem} onSelect={() => void generarEnlace(m)}>
                  <KeyRound className="size-4 text-suave" aria-hidden /> Enlace para nueva contraseña
                </Menu.Item>
              )}
              <Menu.Separator className="my-1 h-px bg-linea" />
              <Menu.Item className={`${claseItem} text-rojo`} onSelect={() => setQuitando(m)}>
                <UserMinus className="size-4" aria-hidden /> {m.esTuCuenta ? "Salir del grupo" : "Quitar del grupo"}
              </Menu.Item>
            </MenuAcciones>
          </li>
        ))}
      </ul>

      {data.invitaciones.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[.12em] text-suave">Pendientes de aceptar</h3>
          <ul className="divide-y divide-linea overflow-hidden rounded-3xl bg-superficie ring-1 ring-linea">
            {data.invitaciones.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 py-3 pr-2 pl-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ambar-claro text-ambar" aria-hidden>
                  <Mail className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{inv.email}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-hundido px-2.5 py-0.5 text-xs font-semibold text-suave">{ETIQUETA_ROL[inv.rol]}</span>
                    {chips(inv.seccionIds)}
                    <span className="text-xs text-suave">Caduca {tiempoHasta(inv.expiraEn)}</span>
                  </span>
                </span>
                <MenuAcciones etiqueta={`Acciones para la invitación de ${inv.email}`}>
                  <Menu.Item className={`${claseItem} text-rojo`} onSelect={() => setRetirando(inv)}>
                    <Trash2 className="size-4" aria-hidden /> Retirar invitación
                  </Menu.Item>
                </MenuAcciones>
              </li>
            ))}
          </ul>
          <p className="text-sm text-suave">Si alguien ha perdido su enlace, vuelve a invitarle: el enlace anterior deja de valer.</p>
        </div>
      )}

      <InvitarDialogo abierto={invitando} onCambiar={setInvitando} />
      <EditarMiembroDialogo miembro={editando} onCerrar={() => setEditando(null)} />

      <Confirmar
        abierto={quitando !== null}
        onCambiar={(v) => !v && setQuitando(null)}
        titulo={quitando?.esTuCuenta ? "¿Salir del grupo?" : `¿Quitar a ${quitando?.usuario.nombre}?`}
        descripcion={
          quitando?.esTuCuenta
            ? "Dejarás de ver la tesorería de este grupo al momento. Para volver, otro administrador tendrá que invitarte."
            : "Perderá el acceso a este grupo al momento. Su cuenta seguirá existiendo por si está en otros grupos."
        }
        accion={quitando?.esTuCuenta ? "Salir" : "Quitar"}
        peligrosa
        onConfirmar={() => quitar.mutateAsync(quitando!.membresiaId)}
      />
      <Confirmar
        abierto={retirando !== null}
        onCambiar={(v) => !v && setRetirando(null)}
        titulo="¿Retirar la invitación?"
        descripcion={`El enlace enviado a ${retirando?.email ?? ""} dejará de funcionar.`}
        accion="Retirar"
        peligrosa
        onConfirmar={() => retirar.mutateAsync(retirando!.id)}
      />

      <Dialogo
        abierto={enlaceDe !== null}
        onCambiar={(v) => !v && setEnlaceDe(null)}
        titulo={`Nueva contraseña para ${enlaceDe?.miembro.usuario.nombre ?? ""}`}
        descripcion="Envíale este enlace: con él elegirá una contraseña nueva y se cerrarán sus sesiones abiertas."
      >
        {enlaceDe && (
          <EnlaceCompartible
            enlace={enlaceDe.enlace}
            mensaje={`Aquí tienes el enlace para elegir una contraseña nueva en la tesorería de ${grupoActivo?.nombre ?? "tu grupo"} (caduca en 24 horas):`}
            caducidad="Caduca en 24 horas y solo se puede usar una vez."
          />
        )}
        <Boton variante="fantasma" className="mt-3 w-full" onClick={() => setEnlaceDe(null)}>Hecho</Boton>
      </Dialogo>
    </section>
  );
};
