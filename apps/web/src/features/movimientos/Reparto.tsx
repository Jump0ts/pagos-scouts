import { Check, Search } from "lucide-react";
import { useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Cargando } from "@/components/Cargando";
import { CampoEuros } from "@/components/CampoEuros";
import { useEducandos, useFichaFamilia } from "@/features/educandos/educandos.api";
import { ChipSeccion } from "@/features/secciones/ChipSeccion";
import { useSecciones } from "@/features/secciones/secciones.api";
import { cx } from "@/utils/cx";
import { aTextoEuros, euros } from "@/utils/dinero";
import { plano } from "@/utils/texto";
import { leerReparto } from "./reparto.utils";

type Props = {
  totalCentimos: number | null;
  familiaId: string | null;
  onFamilia: (id: string) => void;
  // Deuda marcada -> importe escrito en euros.
  importes: Record<string, string>;
  onImportes: (v: Record<string, string>) => void;
};

const MAX_RESULTADOS = 6;

// D-5, D-52: a qué deudas de una familia va un pago y cuánto a cada una, como en la maqueta. Lo que no se reparte
// queda como saldo a favor de la familia (D-48).
export const Reparto = ({ totalCentimos, familiaId, onFamilia, importes, onImportes }: Props) => {
  const [busqueda, setBusqueda] = useState("");
  const { data: lista } = useEducandos();
  const { data: familia, isPending } = useFichaFamilia(familiaId);
  const { data: secciones = [] } = useSecciones();

  const texto = plano(busqueda.trim());
  const resultados = texto
    ? (lista?.educandos ?? []).filter((e) => plano(`${e.nombre} ${e.apellidos}`).includes(texto)).slice(0, MAX_RESULTADOS)
    : [];
  const { repartido, malEscritos, sobra } = leerReparto(importes, totalCentimos);

  const elegirFamilia = (id: string) => {
    setBusqueda("");
    if (id !== familiaId) {
      onFamilia(id);
      onImportes({});
    }
  };
  const marcar = (cargoId: string, pendiente: number, marcado: boolean) => {
    const siguiente = { ...importes };
    if (marcado) siguiente[cargoId] = aTextoEuros(pendiente);
    else delete siguiente[cargoId];
    onImportes(siguiente);
  };

  return (
    <section aria-labelledby="reparto-titulo" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reparto-titulo" className="font-display text-xl font-bold">¿A quién se atribuye?</h2>
        <div className="relative w-full sm:w-72">
          <label className="relative block">
            <span className="sr-only">Buscar a un niño</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-suave" aria-hidden />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={familiaId ? "Buscar otro niño…" : "Buscar a un niño…"}
              className="h-11 w-full rounded-full bg-superficie pr-4 pl-10 text-sm ring-1 ring-linea placeholder:text-suave focus:ring-2 focus:ring-bosque focus:outline-none"
            />
          </label>
          {texto && (
            <ul className="absolute inset-x-0 top-12 z-10 overflow-hidden rounded-2xl bg-superficie shadow-xl ring-1 ring-linea" aria-label="Niños encontrados">
              {resultados.length ? (
                resultados.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => e.familia && elegirFamilia(e.familia.id)}
                      className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-hundido focus:bg-hundido focus:outline-none"
                    >
                      <span className="text-sm font-semibold">{e.nombre} {e.apellidos}</span>
                      <span className="text-xs text-suave">{e.familia?.nombre}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-sm text-suave">Nadie con ese nombre.</li>
              )}
            </ul>
          )}
        </div>
      </div>

      {!familiaId ? (
        <p className="rounded-3xl bg-hundido p-5 text-sm text-suave">Busca a un niño para ver las deudas de su familia.</p>
      ) : isPending || !familia ? (
        <Cargando />
      ) : (
        <>
          <p className="-mt-2 text-sm text-suave">
            <strong className="text-tinta">{familia.nombre}</strong>
            {familia.responsables.length > 0 && ` · ${familia.responsables.map((r) => r.nombreCompleto).join(", ")}`}
          </p>
          <div className="flex flex-col gap-3">
            {familia.educandos.map((nino) => {
              const pendientes = nino.cargos.filter((c) => c.importeCentimos > c.pagadoCentimos);
              const seccion = secciones.find((s) => s.id === nino.seccionId);
              return (
                <div key={nino.id} className="rounded-3xl bg-superficie p-4 ring-1 ring-linea md:p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{nino.nombre}</p>
                    {seccion && <ChipSeccion seccion={seccion} />}
                  </div>
                  {pendientes.length === 0 ? (
                    <p className="text-sm text-suave">Sin deudas pendientes este curso.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {pendientes.map((c) => {
                        const pendiente = c.importeCentimos - c.pagadoCentimos;
                        const marcado = c.id in importes;
                        return (
                          <div
                            key={c.id}
                            className={cx("rounded-2xl p-3 ring-1 transition-colors", marcado ? "bg-bosque-claro ring-bosque" : "bg-hundido ring-transparent hover:ring-linea")}
                          >
                            <button
                              type="button"
                              aria-pressed={marcado}
                              onClick={() => marcar(c.id, pendiente, !marcado)}
                              className="flex w-full items-start gap-3 text-left"
                            >
                              <span
                                className={cx(
                                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ring-1",
                                  marcado ? "bg-bosque text-fondo ring-bosque" : "ring-suave/50",
                                )}
                              >
                                {marcado && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">{c.evento.nombre}</span>
                                <span className="text-xs text-suave">
                                  Pendiente {euros(pendiente)}
                                  {c.pagadoCentimos > 0 && ` (ya pagado ${euros(c.pagadoCentimos)})`}
                                </span>
                              </span>
                            </button>
                            {marcado && (
                              <CampoEuros
                                etiqueta={`Importe para ${c.evento.nombre} de ${nino.nombre}`}
                                etiquetaVisible={false}
                                value={importes[c.id]}
                                onChange={(e) => onImportes({ ...importes, [c.id]: e.target.value })}
                                className="mt-2"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-sm">
              Repartido <strong className="tabular-nums">{euros(repartido)}</strong>
              {totalCentimos !== null && <span className="text-suave"> de {euros(totalCentimos)}</span>}
            </p>
            {malEscritos > 0 && <Aviso tono="error">Revisa los importes: escribe, por ejemplo, 30 o 30,50.</Aviso>}
            {sobra !== null && sobra < 0 && <Aviso tono="error">El reparto pasa del pago en {euros(-sobra)}.</Aviso>}
            {sobra !== null && sobra > 0 && (
              <Aviso tono="info">
                {euros(sobra)} quedarán como saldo a favor de {familia.nombre}.
              </Aviso>
            )}
          </div>
        </>
      )}
    </section>
  );
};
