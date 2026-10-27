import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { useEditarSeccion, useOrdenarSecciones, useSecciones } from "./secciones.api";
import { FONDO_SECCION } from "./secciones.constants";
import type { Seccion } from "./secciones.types";
import { SeccionDialogo } from "./SeccionDialogo";

const BotonIcono = ({ etiqueta, onClick, disabled, children }: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    aria-label={etiqueta}
    title={etiqueta}
    onClick={onClick}
    disabled={disabled}
    className="grid size-10 place-items-center rounded-full text-suave transition hover:bg-hundido hover:text-tinta disabled:opacity-30 disabled:hover:bg-transparent"
  >
    {children}
  </button>
);

export const SeccionesAjustes = () => {
  const { data: secciones, isPending, error } = useSecciones();
  const ordenar = useOrdenarSecciones();
  const editar = useEditarSeccion();
  const [dialogo, setDialogo] = useState<{ abierto: boolean; seccion?: Seccion }>({ abierto: false });
  const [anuncio, setAnuncio] = useState("");

  if (isPending) return <Cargando />;
  if (error || !secciones) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  const mover = (indice: number, desplazamiento: -1 | 1) => {
    const ids = secciones.map((s) => s.id);
    const destino = indice + desplazamiento;
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    ordenar.mutate(ids);
    setAnuncio(`${secciones[indice].nombre} ahora va en la posición ${destino + 1} de ${secciones.length}`);
  };

  return (
    <section aria-labelledby="titulo-secciones" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="titulo-secciones" className="font-display text-xl font-bold">Secciones</h2>
          <p className="max-w-prose text-sm text-suave">
            De la más pequeña a la más mayor: este orden se usa al pasar de curso y para el precio del segundo hermano.
          </p>
        </div>
        <Boton tamano="pequeno" onClick={() => setDialogo({ abierto: true })}>
          <Plus className="size-4" aria-hidden /> Nueva sección
        </Boton>
      </div>

      {(ordenar.error || editar.error) && <Aviso tono="error">{mensajeDeError(ordenar.error ?? editar.error)}</Aviso>}

      <ol className="divide-y divide-linea overflow-hidden rounded-3xl bg-superficie ring-1 ring-linea">
        {secciones.map((seccion, i) => (
          <li key={seccion.id} className={cx("flex items-center gap-3 py-2 pr-2 pl-4", seccion.archivada && "bg-hundido")}>
            <span className={cx("size-3 shrink-0 rounded-full", FONDO_SECCION[seccion.color], seccion.archivada && "opacity-40")} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className={cx("block truncate font-semibold", seccion.archivada && "text-suave")}>{seccion.nombre}</span>
              {seccion.archivada && <span className="text-xs text-suave">Archivada: no se puede asignar a nadie</span>}
            </span>
            <BotonIcono etiqueta={`Subir ${seccion.nombre}`} onClick={() => mover(i, -1)} disabled={i === 0 || ordenar.isPending}>
              <ArrowUp className="size-4" aria-hidden />
            </BotonIcono>
            <BotonIcono
              etiqueta={`Bajar ${seccion.nombre}`}
              onClick={() => mover(i, 1)}
              disabled={i === secciones.length - 1 || ordenar.isPending}
            >
              <ArrowDown className="size-4" aria-hidden />
            </BotonIcono>
            <BotonIcono etiqueta={`Editar ${seccion.nombre}`} onClick={() => setDialogo({ abierto: true, seccion })}>
              <Pencil className="size-4" aria-hidden />
            </BotonIcono>
            <BotonIcono
              etiqueta={seccion.archivada ? `Recuperar ${seccion.nombre}` : `Archivar ${seccion.nombre}`}
              onClick={() => editar.mutate({ id: seccion.id, archivada: !seccion.archivada })}
            >
              {seccion.archivada ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
            </BotonIcono>
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{anuncio}</p>

      <SeccionDialogo abierto={dialogo.abierto} seccion={dialogo.seccion} onCambiar={(abierto) => setDialogo((d) => ({ ...d, abierto }))} />
    </section>
  );
};
