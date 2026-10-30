import { ArrowRight, CalendarRange } from "lucide-react";
import { Link } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { mensajeDeError } from "@/utils/api";
import { useCursos } from "./cursos.api";
import { cursoSiguiente } from "./cursos.utils";

// D-84: el curso activo, los anteriores y la entrada al paso de curso. Solo Admin.
export const CursoAjustes = () => {
  const { data, isPending, error } = useCursos();

  if (isPending) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  const activo = data.cursos.find((c) => c.activo);
  const anteriores = data.cursos.filter((c) => !c.activo);

  return (
    <section aria-labelledby="titulo-curso" className="flex flex-col gap-4">
      <div>
        <h2 id="titulo-curso" className="font-display text-xl font-bold">Curso</h2>
        <p className="max-w-prose text-sm text-suave">
          Los niños, los eventos y las deudas son de un curso. Al pasar de curso, cada niño se matricula en su sección del
          curso siguiente y lo anterior queda para consultar.
        </p>
      </div>

      {activo ? (
        <div className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-bosque-claro text-bosque">
              <CalendarRange className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold text-suave">Curso activo</p>
              <p className="font-display text-2xl font-bold tabular-nums">{activo.nombre}</p>
            </div>
          </div>
          <Link
            to="paso"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-bosque px-5 text-sm font-semibold text-fondo transition hover:brightness-110"
          >
            Pasar a {cursoSiguiente(activo.nombre)} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <Aviso>Todavía no hay ningún curso: se crea al importar el listado o al dar de alta al primer niño.</Aviso>
      )}

      {anteriores.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Cursos anteriores</h3>
          <ul className="flex flex-wrap gap-2">
            {anteriores.map((c) => (
              <li key={c.id} className="rounded-full bg-hundido px-3 py-1 text-sm font-semibold tabular-nums text-suave">{c.nombre}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
