import { Plus } from "lucide-react";
import { euros } from "@/utils/dinero";
import type { Articulo, LineaEntrada } from "./pedidos.types";
import { UnidadEditor } from "./UnidadEditor";

type Props = {
  articulos: Articulo[];
  lineas: LineaEntrada[];
  onCambiar: (lineas: LineaEntrada[]) => void;
  // El formulario publico respeta las unidades maximas; Tesoreria, a mano, no (D-66).
  conTope?: boolean;
  // Errores por posicion en `lineas`, despues de intentar enviar.
  errores?: (string | null)[];
};

// Los articulos del pedido con un boton para añadir unidades; cada unidad, con sus opciones.
export const EleccionArticulos = ({ articulos, lineas, onCambiar, conTope = true, errores = [] }: Props) => (
  <div className="flex flex-col gap-4">
    {articulos.map((a) => {
      const posiciones = lineas.flatMap((l, i) => (l.articuloId === a.id ? [i] : []));
      const lleno = conTope && posiciones.length >= a.maxUnidades;
      return (
        <section key={a.id} aria-label={a.nombre} className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold">{a.nombre}</h3>
              <p className="text-sm text-suave">
                {euros(a.precioCentimos)}
                {conTope && a.maxUnidades > 1 && ` · hasta ${a.maxUnidades}`}
              </p>
            </div>
            <button
              type="button"
              disabled={lleno}
              onClick={() => onCambiar([...lineas, { articuloId: a.id, elecciones: [] }])}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-bosque-claro px-3.5 text-sm font-semibold text-bosque transition hover:brightness-95 disabled:opacity-45"
            >
              <Plus className="size-4" aria-hidden /> Añadir
            </button>
          </div>
          {posiciones.map((i, n) => (
            <UnidadEditor
              key={i}
              articulo={a}
              linea={lineas[i]}
              numero={n + 1}
              error={errores[i]}
              onCambiar={(nueva) => onCambiar(lineas.map((l, j) => (j === i ? nueva : l)))}
              onQuitar={() => onCambiar(lineas.filter((_, j) => j !== i))}
            />
          ))}
        </section>
      );
    })}
  </div>
);
