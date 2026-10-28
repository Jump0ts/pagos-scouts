import { ArrowLeft, CircleCheck, Lightbulb, Link2, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { Dialogo } from "@/components/Dialogo";
import { mensajeDeError } from "@/utils/api";
import { aTextoEuros, euros } from "@/utils/dinero";
import { FilaMovimiento } from "./FilaMovimiento";
import { useCruzar, useMovimiento, useOtroIngreso, useResolverDuda } from "./movimientos.api";
import { ETIQUETA_MEDIO, MOTIVOS } from "./movimientos.constants";
import type { Apuntado, Movimiento } from "./movimientos.types";
import { Reparto } from "./Reparto";
import { leerReparto } from "./reparto.utils";

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });

const origenDe = (a: Apuntado) =>
  a.origen === "LISTADO" ? "Marcado en el listado" : `Apuntado a mano${a.medio ? ` · ${ETIQUETA_MEDIO[a.medio]}` : ""}`;

// El movimiento como un justificante bancario (maqueta), con el porqué de la duda.
const Justificante = ({ m }: { m: Movimiento }) => {
  const motivo = m.motivo ? MOTIVOS[m.motivo] : null;
  return (
    <div className="rounded-3xl bg-tinta p-5 text-fondo md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[.14em] uppercase opacity-60">
            Ingreso del banco{m.fecha && ` · ${fechaLarga(m.fecha)}`}
          </p>
          <p className="mt-1 truncate font-display text-xl font-bold md:text-2xl">{m.concepto}</p>
        </div>
        <p className="font-display text-4xl font-bold tabular-nums">{euros(m.importeCentimos)}</p>
      </div>
      {motivo && (
        <>
          <div className="my-4 border-t border-dashed border-fondo/25" />
          <p className="flex gap-2.5 text-sm">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-ambar" aria-hidden />
            <span>
              <strong className="text-ambar">{motivo.etiqueta}.</strong> <span className="opacity-80">{motivo.explicacion}</span>
            </span>
          </p>
        </>
      )}
    </div>
  );
};

// D-5: resolver una duda. Arriba el ingreso; si puede ser un pago ya apuntado, la opción de cruzarlo (D-51); debajo
// el reparto entre las deudas de una familia y la casilla para recordar a quien paga (D-1).
export const DudaPagina = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isPending, error } = useMovimiento(id);
  const resolver = useResolverDuda();
  const cruzar = useCruzar();
  const otroIngreso = useOtroIngreso();

  const [familiaId, setFamiliaId] = useState<string | null>(null);
  const [importes, setImportes] = useState<Record<string, string>>({});
  const [recordar, setRecordar] = useState(true);
  const [preparado, setPreparado] = useState(false);
  const [otroAbierto, setOtroAbierto] = useState(false);
  const [nota, setNota] = useState("");

  // La sugerencia de la app, ya marcada (D-5).
  useEffect(() => {
    if (!data || preparado) return;
    setFamiliaId(data.movimiento.familia?.id ?? null);
    setImportes(Object.fromEntries(data.movimiento.cargos.map((c) => [c.cargoId, aTextoEuros(c.importeCentimos)])));
    setRecordar(!data.pagadorConocido);
    setPreparado(true);
  }, [data, preparado]);

  if (isPending) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;
  const m = data.movimiento;
  const volver = (
    <Link to="/movimientos" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
      <ArrowLeft className="size-4" aria-hidden /> Movimientos
    </Link>
  );

  if (m.estado !== "DUDA") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        {volver}
        <Aviso tono="info">Este movimiento ya no está en Dudas.</Aviso>
        <ul>
          <FilaMovimiento movimiento={m} />
        </ul>
      </div>
    );
  }

  const { asignaciones, malEscritos, sobra } = leerReparto(importes, m.importeCentimos);
  const conocidoAqui = data.pagadorConocido?.familiaId === familiaId;
  const listo = Boolean(familiaId) && malEscritos === 0 && sobra !== null && sobra >= 0;

  const guardar = async () => {
    if (!familiaId) return;
    const res = await resolver.mutateAsync({ id: m.id, familiaId, asignaciones, recordarPagador: recordar && !conocidoAqui });
    const extra = res.reintentadas
      ? ` Además, ${res.reintentadas} ${res.reintentadas === 1 ? "pago más" : "pagos más"} de ${m.concepto} se han clasificado solos.`
      : "";
    navigate("/movimientos", { state: { aviso: `Duda resuelta.${extra}` } });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-4">
      {volver}
      <Justificante m={m} />

      {data.candidatosCruce.length > 0 && (
        <section aria-labelledby="cruce-titulo" className="flex flex-col gap-3 rounded-3xl bg-ambar-claro p-4 md:p-5">
          <h2 id="cruce-titulo" className="flex items-center gap-2 font-semibold">
            <Link2 className="size-4" aria-hidden /> ¿Es el mismo pago que ya está apuntado?
          </h2>
          <ul className="flex flex-col gap-2">
            {data.candidatosCruce.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-superficie p-3 ring-1 ring-linea">
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold">{a.concepto}</span>
                  <span className="text-suave">
                    {origenDe(a)}
                    {a.fecha && ` · ${fechaLarga(a.fecha)}`} · {euros(a.importeCentimos)}
                  </span>
                </span>
                <Boton
                  tamano="pequeno"
                  cargando={cruzar.isPending}
                  onClick={async () => {
                    const ok = await cruzar.mutateAsync({ id: m.id, movimientoId: a.id }).then(() => true, () => false);
                    if (ok) navigate("/movimientos", { state: { aviso: "Cruzado: el ingreso del banco se queda con el reparto del pago apuntado." } });
                  }}
                >
                  Es el mismo pago
                </Boton>
              </li>
            ))}
          </ul>
          {cruzar.error && <Aviso tono="error">{mensajeDeError(cruzar.error)}</Aviso>}
          <p className="text-sm text-suave">Si es otro pago distinto, repártelo abajo como cualquier otro.</p>
        </section>
      )}

      <Reparto totalCentimos={m.importeCentimos} familiaId={familiaId} onFamilia={setFamiliaId} importes={importes} onImportes={setImportes} />

      {familiaId && !conocidoAqui && (
        <label className="flex w-fit cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={recordar}
            onChange={(e) => setRecordar(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-bosque)]"
          />
          <span>
            <strong>Recordar «{m.concepto}» para esta familia</strong>
            <span className="block text-suave">Sus próximos pagos se reconocerán solos, y se reintentarán sus otras dudas.</span>
          </span>
        </label>
      )}

      {resolver.error && <Aviso tono="error">{mensajeDeError(resolver.error)}</Aviso>}
      <div className="sticky bottom-20 flex flex-col-reverse gap-2 rounded-3xl bg-superficie/95 p-3 ring-1 ring-linea backdrop-blur sm:flex-row sm:justify-between md:bottom-4">
        <Boton variante="secundario" onClick={() => setOtroAbierto(true)}>
          <Tag className="size-4" aria-hidden /> No es de familias
        </Boton>
        <Boton onClick={() => void guardar().catch(() => undefined)} cargando={resolver.isPending} disabled={!listo}>
          <CircleCheck className="size-4" aria-hidden /> Guardar
        </Boton>
      </div>

      <Dialogo
        abierto={otroAbierto}
        onCambiar={setOtroAbierto}
        titulo="No es de ninguna familia"
        descripcion="Sale de Dudas y queda en «Otros ingresos». Puedes deshacerlo cuando quieras."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await otroIngreso.mutateAsync({ id: m.id, nota }).then(() => true, () => false);
            if (ok) navigate("/movimientos?ver=otros", { state: { aviso: "Guardado como otro ingreso." } });
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Nota (opcional)</span>
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={120}
              placeholder="Subvención, donación, reintegro…"
              className="h-12 rounded-2xl bg-superficie px-4 text-base ring-1 ring-linea focus:ring-2 focus:ring-bosque focus:outline-none"
            />
          </label>
          {otroIngreso.error && <Aviso tono="error">{mensajeDeError(otroIngreso.error)}</Aviso>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setOtroAbierto(false)}>Cancelar</Boton>
            <Boton type="submit" cargando={otroIngreso.isPending}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
    </div>
  );
};
