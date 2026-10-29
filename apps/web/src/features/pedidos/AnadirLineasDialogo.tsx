import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Dialogo } from "@/components/Dialogo";
import { useEducandos } from "@/features/educandos/educandos.api";
import { useSecciones } from "@/features/secciones/secciones.api";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { EleccionArticulos } from "./EleccionArticulos";
import { useAnadirLineas } from "./pedidos.api";
import type { Articulo, LineaEntrada } from "./pedidos.types";
import { precioDe, problemaDe } from "./pedidos.utils";

const plano = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

type Props = {
  pedidoId: string;
  articulos: Articulo[];
  abierto: boolean;
  onCambiar: (v: boolean) => void;
  // Para añadir a alguien que ya tiene pedido, desde su fila.
  educandoInicial?: string | null;
};

// D-68: lo que una familia pide en persona. Tesoreria elige a quien y que; sin tope de unidades.
export const AnadirLineasDialogo = ({ pedidoId, articulos, abierto, onCambiar, educandoInicial = null }: Props) => {
  const { data: lista } = useEducandos();
  const { data: secciones = [] } = useSecciones();
  const anadir = useAnadirLineas();
  const [busqueda, setBusqueda] = useState("");
  const [educandoId, setEducandoId] = useState<string | null>(educandoInicial);
  const [lineas, setLineas] = useState<LineaEntrada[]>([]);
  const [errores, setErrores] = useState<(string | null)[]>([]);

  const candidatos = useMemo(() => {
    const texto = plano(busqueda.trim());
    return (lista?.educandos ?? []).filter((e) => !texto || plano(`${e.nombre} ${e.apellidos}`).includes(texto)).slice(0, 30);
  }, [lista, busqueda]);
  const elegido = lista?.educandos.find((e) => e.id === educandoId);
  const total = lineas.reduce((n, l) => n + precioDe(articulos.find((a) => a.id === l.articuloId)!, l), 0);

  const cerrar = (v: boolean) => {
    if (!v) {
      setBusqueda("");
      setEducandoId(educandoInicial);
      setLineas([]);
      setErrores([]);
      anadir.reset();
    }
    onCambiar(v);
  };

  const guardar = async () => {
    const problemas = lineas.map((l) => problemaDe(articulos.find((a) => a.id === l.articuloId)!, l));
    setErrores(problemas);
    if (!educandoId || !lineas.length || problemas.some(Boolean)) return;
    try {
      await anadir.mutateAsync({ id: pedidoId, educandoId, lineas });
      cerrar(false);
    } catch {
      // El error se muestra con el estado de la mutacion.
    }
  };

  return (
    <Dialogo abierto={abierto} onCambiar={cerrar} titulo="Apuntar a mano" descripcion="Para quien os lo pide en persona. Cuenta en cuanto lo guardas.">
      <div className="flex flex-col gap-4">
        {elegido ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-bosque-claro px-4 py-3">
            <span className="text-sm">
              <span className="font-semibold">{elegido.nombre}</span> {elegido.apellidos}
              <span className="text-suave"> · {secciones.find((s) => s.id === elegido.seccionId)?.nombre}</span>
            </span>
            {!educandoInicial && (
              <button type="button" onClick={() => setEducandoId(null)} className="text-sm font-semibold text-bosque">
                Cambiar
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="relative">
              <span className="sr-only">Buscar a quién</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-suave" aria-hidden />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="¿Para quién es?"
                className="h-12 w-full rounded-2xl bg-superficie pr-4 pl-11 text-base ring-1 ring-linea placeholder:text-suave focus:outline-none focus:ring-2 focus:ring-bosque"
              />
            </label>
            <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
              {candidatos.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setEducandoId(e.id)} className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-hundido">
                    <span className="font-semibold">{e.nombre}</span> <span className="text-suave">{e.apellidos}</span>
                    <span className="text-suave"> · {secciones.find((s) => s.id === e.seccionId)?.nombre}</span>
                  </button>
                </li>
              ))}
              {candidatos.length === 0 && <li className="py-3 text-center text-sm text-suave">No hay nadie con ese nombre.</li>}
            </ul>
          </div>
        )}

        <div className={cx(!elegido && "pointer-events-none opacity-50")} aria-disabled={!elegido}>
          <EleccionArticulos articulos={articulos} lineas={lineas} onCambiar={setLineas} conTope={false} errores={errores} />
        </div>

        {anadir.error && <Aviso tono="error">{mensajeDeError(anadir.error)}</Aviso>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-suave tabular-nums">Total {euros(total)}</span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Boton variante="secundario" onClick={() => cerrar(false)}>
              Cancelar
            </Boton>
            <Boton onClick={guardar} cargando={anadir.isPending} disabled={!elegido || !lineas.length}>
              Guardar
            </Boton>
          </div>
        </div>
      </div>
    </Dialogo>
  );
};
