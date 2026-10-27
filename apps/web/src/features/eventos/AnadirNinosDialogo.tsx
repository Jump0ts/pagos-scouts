import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Dialogo } from "@/components/Dialogo";
import { useEducandos } from "@/features/educandos/educandos.api";
import { mensajeDeError } from "@/utils/api";
import { useAnadirNinos } from "./eventos.api";
import type { DetalleEvento } from "./eventos.types";

const plano = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Apuntar a mas niños (eventos con apuntados) o volver a añadir a alguien que se quito del evento.
export const AnadirNinosDialogo = ({ detalle, abierto, onCambiar }: { detalle: DetalleEvento; abierto: boolean; onCambiar: (v: boolean) => void }) => {
  const { data: lista } = useEducandos();
  const anadir = useAnadirNinos();
  const [busqueda, setBusqueda] = useState("");
  const [elegidos, setElegidos] = useState<string[]>([]);

  const candidatos = useMemo(() => {
    const secciones = new Set(detalle.evento.precios.map((p) => p.seccionId));
    const yaEstan = new Set(detalle.cargos.map((c) => c.educando.id));
    const texto = plano(busqueda.trim());
    return (lista?.educandos ?? []).filter(
      (e) => secciones.has(e.seccionId) && !yaEstan.has(e.id) && (!texto || plano(`${e.nombre} ${e.apellidos}`).includes(texto)),
    );
  }, [lista, detalle, busqueda]);

  const cerrar = (v: boolean) => {
    if (!v) {
      setElegidos([]);
      setBusqueda("");
    }
    onCambiar(v);
  };

  const guardar = async () => {
    try {
      await anadir.mutateAsync({ id: detalle.evento.id, educandoIds: elegidos });
      cerrar(false);
    } catch {
      // El error se muestra con el estado de la mutacion.
    }
  };

  return (
    <Dialogo abierto={abierto} onCambiar={cerrar} titulo="Añadir niños" descripcion="Solo aparecen los niños de las secciones del evento que aún no están.">
      <div className="flex flex-col gap-3">
        <label className="relative">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-suave" aria-hidden />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre…"
            className="h-12 w-full rounded-2xl bg-superficie pr-4 pl-11 text-base ring-1 ring-linea placeholder:text-suave focus:outline-none focus:ring-2 focus:ring-bosque"
          />
        </label>
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {candidatos.length === 0 && <p className="py-4 text-center text-sm text-suave">No hay nadie más que añadir.</p>}
          {candidatos.map((n) => {
            const marcado = elegidos.includes(n.id);
            return (
              <label key={n.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-hundido">
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => setElegidos(marcado ? elegidos.filter((x) => x !== n.id) : [...elegidos, n.id])}
                  className="size-5 accent-[var(--color-bosque)]"
                />
                <span className="text-sm">
                  {n.nombre} <span className="text-suave">{n.apellidos}</span>
                </span>
              </label>
            );
          })}
        </div>
        {anadir.error && <Aviso tono="error">{mensajeDeError(anadir.error)}</Aviso>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={() => cerrar(false)}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={elegidos.length === 0} cargando={anadir.isPending}>
            Añadir {elegidos.length || ""}
          </Boton>
        </div>
      </div>
    </Dialogo>
  );
};
