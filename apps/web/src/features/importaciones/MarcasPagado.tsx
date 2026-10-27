import { CircleCheck } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { useEventos } from "@/features/eventos/eventos.api";
import type { AnalisisListado } from "./importaciones.types";

type Props = {
  analisis: AnalisisListado;
  curso: string;
  valor: Record<string, string>;
  onCambiar: (v: Record<string, string>) => void;
};

// D-44: cada columna con marcas "Pagado" se puede ligar a un evento del curso; cada marca será un pago por lo que
// le falte a ese niño en el evento.
export const MarcasPagado = ({ analisis, curso, valor, onCambiar }: Props) => {
  const { data } = useEventos();
  const eventos = data?.eventos ?? [];
  const delCurso = data?.curso?.nombre === curso;

  return (
    <section aria-labelledby="marcas-pagado" className="flex flex-col gap-3 rounded-3xl bg-superficie p-4 ring-1 ring-linea">
      <div>
        <h2 id="marcas-pagado" className="flex items-center gap-2 font-semibold">
          <CircleCheck className="size-4 text-bosque" aria-hidden /> Marcas «Pagado»
        </h2>
        <p className="text-sm text-suave">
          ¿A qué evento corresponde cada columna? Cada marca se apunta como pagada en ese evento. Si no eliges ninguno,
          no se importan.
        </p>
      </div>
      {!delCurso || eventos.length === 0 ? (
        <Aviso tono="info">
          {delCurso
            ? "Aún no hay eventos en este curso. Créalos (cuota, censo…) y vuelve a importar el listado para apuntar estas marcas."
            : `Las marcas solo se pueden apuntar en los eventos del curso actual${data?.curso ? ` (${data.curso.nombre})` : ""}.`}
        </Aviso>
      ) : (
        <ul className="flex flex-col gap-2">
          {analisis.columnasPago.map((c) => (
            <li key={c.clave} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1">
                <span className="font-semibold">{c.titulo}</span>{" "}
                <span className="text-sm text-suave">· {c.marcas} {c.marcas === 1 ? "marca" : "marcas"}</span>
              </p>
              <label className="sm:w-56">
                <span className="sr-only">Evento de la columna {c.titulo}</span>
                <select
                  value={valor[c.clave] ?? ""}
                  onChange={(e) => onCambiar({ ...valor, [c.clave]: e.target.value })}
                  className="h-12 w-full rounded-2xl bg-superficie px-4 text-base ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
                >
                  <option value="">No importar</option>
                  {eventos.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
