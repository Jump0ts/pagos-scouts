import { ArrowLeft, CircleCheck, Lock } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Pasos } from "@/components/Pasos";
import { SubirArchivo } from "@/components/SubirArchivo";
import { mensajeDeError } from "@/utils/api";
import { FilaMovimiento } from "./FilaMovimiento";
import { useAnalizarMovimientos, useConfirmarMovimientos } from "./movimientos.api";
import type { ResumenImportacion } from "./movimientos.types";

const PASOS = ["Subir el Excel", "Revisar y confirmar"];
const fecha = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

// D-41: subir el Excel del banco, ver qué pasaría y confirmar. El fichero no se guarda.
export const ImportarMovimientosPagina = () => {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<ResumenImportacion | null>(null);
  const [resultado, setResultado] = useState<ResumenImportacion | null>(null);
  const analizar = useAnalizarMovimientos();
  const confirmar = useConfirmarMovimientos();

  const empezar = async (elegido: File) => {
    const res = await analizar.mutateAsync(elegido).catch(() => null);
    if (!res) return;
    setArchivo(elegido);
    setAnalisis(res);
  };

  if (resultado) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <h1 className="font-display text-3xl font-bold tracking-tight">Movimientos importados</h1>
        <Aviso tono="exito">
          {plural(resultado.nuevos, "ingreso nuevo", "ingresos nuevos")}: {plural(resultado.clasificados, "clasificado solo", "clasificados solos")} y{" "}
          {plural(resultado.dudas, "en Dudas", "en Dudas")}.
        </Aviso>
        <div className="flex flex-wrap gap-2">
          {resultado.dudas > 0 && (
            <Link to="/movimientos" className="inline-flex h-12 items-center rounded-full bg-bosque px-5 text-sm font-semibold text-fondo">
              Ver las dudas
            </Link>
          )}
          <Link
            to="/movimientos?ver=clasificados"
            className="inline-flex h-12 items-center rounded-full bg-superficie px-5 text-sm font-semibold ring-1 ring-linea hover:bg-hundido"
          >
            Ver los clasificados
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link to="/movimientos" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> Movimientos
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">Importar del banco</h1>
        <Pasos pasos={PASOS} actual={analisis ? 1 : 0} etiqueta="Pasos de la importación" />
      </div>

      {!analisis || !archivo ? (
        <section className="flex flex-col gap-4">
          <SubirArchivo titulo="Elige el Excel de movimientos" tituloCargando="Leyendo los movimientos…" onArchivo={empezar} cargando={analizar.isPending} />
          {analizar.error && <Aviso tono="error">{mensajeDeError(analizar.error)}</Aviso>}
          <div className="grid gap-3 text-sm text-suave sm:grid-cols-2">
            <p className="rounded-2xl bg-hundido p-4">
              <strong className="block text-tinta">Qué Excel subir</strong>
              El de «Movimientos de la cuenta» de Unicaja, tal cual lo descargas. Puedes subir periodos que se solapen: lo
              ya importado se reconoce y no se repite.
            </p>
            <p className="flex gap-2.5 rounded-2xl bg-hundido p-4">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong className="block text-tinta">El fichero no se guarda</strong>
                Solo se guardan los ingresos (fecha, quién paga e importe). Las salidas, como gastos o comisiones, se ignoran.
              </span>
            </p>
          </div>
        </section>
      ) : (
        <PasoRevisar
          analisis={analisis}
          nombreArchivo={archivo.name}
          onAtras={() => {
            setAnalisis(null);
            confirmar.reset();
          }}
          onImportar={async () => setResultado(await confirmar.mutateAsync(archivo))}
          importando={confirmar.isPending}
          error={confirmar.error}
        />
      )}
    </div>
  );
};

type PropsRevisar = {
  analisis: ResumenImportacion;
  nombreArchivo: string;
  onAtras: () => void;
  onImportar: () => Promise<void>;
  importando: boolean;
  error: unknown;
};

const PasoRevisar = ({ analisis, nombreArchivo, onAtras, onImportar, importando, error }: PropsRevisar) => {
  const clasificados = analisis.movimientos.filter((m) => m.estado === "CLASIFICADO");
  const dudas = analisis.movimientos.filter((m) => m.estado === "DUDA");

  return (
    <section className="flex flex-col gap-5">
      <p className="text-suave">
        <strong className="text-tinta">{nombreArchivo}</strong>
        {analisis.desde && analisis.hasta && ` · ingresos del ${fecha(analisis.desde)} al ${fecha(analisis.hasta)}`}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { etiqueta: "Se clasifican solos", valor: analisis.clasificados },
          { etiqueta: "Irán a Dudas", valor: analisis.dudas },
          { etiqueta: "Ya importados", valor: analisis.yaImportados },
          { etiqueta: "Salidas ignoradas", valor: analisis.salidasIgnoradas },
        ].map((c) => (
          <div key={c.etiqueta} className="rounded-2xl bg-superficie p-4 ring-1 ring-linea">
            <dt className="text-xs font-semibold text-suave">{c.etiqueta}</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">{c.valor}</dd>
          </div>
        ))}
      </dl>

      {analisis.nuevos === 0 && <Aviso tono="info">No hay ingresos nuevos: todo lo de este Excel ya estaba importado.</Aviso>}

      {[
        { titulo: "Se clasifican solos", lista: clasificados },
        { titulo: "Irán a Dudas", lista: dudas },
      ].map(
        ({ titulo, lista }) =>
          lista.length > 0 && (
            <section key={titulo} aria-label={titulo} className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold">
                {titulo} <span className="text-suave tabular-nums">{lista.length}</span>
              </h2>
              <ul className="flex flex-col gap-3">
                {lista.map((m, i) => (
                  <FilaMovimiento key={`${m.fecha}-${m.concepto}-${i}`} movimiento={m} />
                ))}
              </ul>
            </section>
          ),
      )}

      {Boolean(error) && <Aviso tono="error">{mensajeDeError(error)}</Aviso>}
      <div className="sticky bottom-20 flex flex-col-reverse gap-2 rounded-3xl bg-superficie/95 p-3 ring-1 ring-linea backdrop-blur sm:flex-row sm:justify-between md:bottom-4">
        <Boton variante="secundario" onClick={onAtras}>Subir otro fichero</Boton>
        {analisis.nuevos > 0 && (
          <Boton onClick={() => void onImportar().catch(() => undefined)} cargando={importando}>
            <CircleCheck className="size-4" aria-hidden /> Importar {plural(analisis.nuevos, "ingreso", "ingresos")}
          </Boton>
        )}
      </div>
    </section>
  );
};
