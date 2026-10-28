import { ChevronRight, FileUp, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { usePerfil } from "@/features/auth/useSesion";
import { useSecciones } from "@/features/secciones/secciones.api";
import { FONDO_SECCION } from "@/features/secciones/secciones.constants";
import { mensajeDeError } from "@/utils/api";
import { plano } from "@/utils/texto";
import { cx } from "@/utils/cx";
import { EducandoDialogo } from "./EducandoDialogo";
import { useEducandos } from "./educandos.api";
import { FichaFamiliaDialogo } from "./FichaFamiliaDialogo";


// D-32: lista por secciones con buscador; al tocar un niño se abre la ficha de su familia (no para scouters).
export const EducandosPagina = () => {
  const { grupoActivo } = usePerfil();
  const gestiona = grupoActivo?.rol === "ADMIN" || grupoActivo?.rol === "TESORERIA";
  const { data, isPending, error } = useEducandos();
  const { data: secciones = [] } = useSecciones();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<string | null>(null);
  const [familiaAbierta, setFamiliaAbierta] = useState<string | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);

  const educandos = useMemo(() => data?.educandos ?? [], [data]);
  const visibles = useMemo(() => {
    const texto = plano(busqueda.trim());
    return educandos.filter(
      (e) => (!filtro || e.seccionId === filtro) && (!texto || plano(`${e.nombre} ${e.apellidos}`).includes(texto)),
    );
  }, [educandos, busqueda, filtro]);

  if (isPending) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  // Solo las secciones que tienen a alguien (un scouter solo recibe las suyas).
  const conNinos = secciones.filter((s) => educandos.some((e) => e.seccionId === s.id));
  const porSeccion = conNinos
    .map((s) => ({ seccion: s, ninos: visibles.filter((e) => e.seccionId === s.id) }))
    .filter((g) => g.ninos.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Educandos</h1>
          <p className="text-suave">
            {data.curso ? `Curso ${data.curso.nombre} · ${educandos.length} ${educandos.length === 1 ? "niño" : "niños"}` : "Todavía no hay ningún curso"}
          </p>
        </div>
        {gestiona && (
          <div className="flex gap-2">
            <Link
              to="/educandos/importar"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-superficie px-3.5 text-sm font-semibold ring-1 ring-linea hover:bg-hundido"
            >
              <FileUp className="size-4" aria-hidden /> Importar listado
            </Link>
            <Boton tamano="pequeno" onClick={() => setAnadiendo(true)}>
              <Plus className="size-4" aria-hidden /> Añadir
            </Boton>
          </div>
        )}
      </div>

      {educandos.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-linea p-10 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-hundido text-suave">
            <Users className="size-6" aria-hidden />
          </span>
          <h2 className="font-display text-xl font-bold">Aún no hay educandos</h2>
          <p className="max-w-md text-suave">
            {gestiona
              ? "Importa el Excel del listado del grupo o añádelos uno a uno."
              : "Cuando tesorería cargue el listado, aquí verás a los niños de tus secciones."}
          </p>
          {gestiona && (
            <Link to="/educandos/importar" className="mt-1 inline-flex h-12 items-center gap-2 rounded-full bg-bosque px-5 text-sm font-semibold text-fondo">
              <FileUp className="size-4" aria-hidden /> Importar listado
            </Link>
          )}
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <label className="relative">
              <span className="sr-only">Buscar por nombre</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-suave" aria-hidden />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre…"
                className="h-12 w-full rounded-full bg-superficie pr-4 pl-11 text-base ring-1 ring-linea placeholder:text-suave focus:outline-none focus:ring-2 focus:ring-bosque sm:max-w-sm"
              />
            </label>
            <div role="group" aria-label="Filtrar por sección" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {[{ id: null, nombre: "Todas", color: null }, ...conNinos].map((s) => {
                const activo = filtro === s.id;
                return (
                  <button
                    key={s.id ?? "todas"}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setFiltro(s.id)}
                    className={cx(
                      "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                      activo ? "bg-tinta text-fondo ring-tinta" : "bg-superficie text-suave ring-linea hover:text-tinta",
                    )}
                  >
                    {s.color && <span className={cx("size-2.5 rounded-full", FONDO_SECCION[s.color])} aria-hidden />}
                    {s.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {porSeccion.length === 0 && (
            <p className="rounded-3xl bg-superficie p-6 text-center text-suave ring-1 ring-linea">
              Nadie coincide con «{busqueda}».
            </p>
          )}

          {porSeccion.map(({ seccion, ninos }) => (
            <section key={seccion.id} aria-labelledby={`seccion-${seccion.id}`} className="flex flex-col gap-2">
              <h2 id={`seccion-${seccion.id}`} className="flex items-center gap-2 text-xs font-bold tracking-[.12em] text-suave uppercase">
                <span className={cx("size-2.5 rounded-full", FONDO_SECCION[seccion.color])} aria-hidden />
                {seccion.nombre} · {ninos.length}
              </h2>
              <ul className="divide-y divide-linea overflow-hidden rounded-3xl bg-superficie ring-1 ring-linea">
                {ninos.map((e) => {
                  const contenido = (
                    <>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold">{e.nombre}</span> <span className="text-suave">{e.apellidos}</span>
                      </span>
                      {e.familia && <span className="hidden truncate text-sm text-suave sm:block">{e.familia.nombre}</span>}
                    </>
                  );
                  return (
                    <li key={e.id}>
                      {gestiona && e.familia ? (
                        <button
                          type="button"
                          onClick={() => setFamiliaAbierta(e.familia!.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hundido"
                          aria-label={`${e.nombre} ${e.apellidos}: abrir la ficha de su familia`}
                        >
                          {contenido}
                          <ChevronRight className="size-4 shrink-0 text-suave" aria-hidden />
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3">{contenido}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </>
      )}

      {gestiona && (
        <>
          <FichaFamiliaDialogo familiaId={familiaAbierta} onCerrar={() => setFamiliaAbierta(null)} />
          <EducandoDialogo
            abierto={anadiendo}
            onCambiar={setAnadiendo}
            alGuardar={(familiaId) => setFamiliaAbierta(familiaId)}
          />
        </>
      )}
    </div>
  );
};
