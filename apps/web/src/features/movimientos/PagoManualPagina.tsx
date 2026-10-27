import { ArrowLeft, CircleCheck } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { CampoEuros } from "@/components/CampoEuros";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { aCentimos } from "@/utils/dinero";
import { usePagoManual } from "./movimientos.api";
import { MEDIOS } from "./movimientos.constants";
import type { MedioPago } from "./movimientos.types";
import { Reparto } from "./Reparto";
import { leerReparto } from "./reparto.utils";

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// D-46: apuntar un pago que no llega por el Excel del banco (efectivo, Bizum a una cuenta personal…), con el mismo
// reparto que una duda. Si luego llega por el banco, se avisa para no contarlo dos veces (D-51).
export const PagoManualPagina = () => {
  const navigate = useNavigate();
  const guardar = usePagoManual();
  const [fecha, setFecha] = useState(hoy);
  const [concepto, setConcepto] = useState("");
  const [importe, setImporte] = useState("");
  const [medio, setMedio] = useState<MedioPago>("EFECTIVO");
  const [familiaId, setFamiliaId] = useState<string | null>(null);
  const [importes, setImportes] = useState<Record<string, string>>({});
  const [intentado, setIntentado] = useState(false);

  const total = aCentimos(importe);
  const { asignaciones, malEscritos, sobra } = leerReparto(importes, total);
  const errores = {
    concepto: concepto.trim().length < 2 ? "Escribe quién ha pagado" : undefined,
    importe: !total ? "Escribe el importe, por ejemplo 30 o 30,50" : undefined,
    fecha: fecha ? undefined : "Elige la fecha",
  };
  const valido = !errores.concepto && !errores.importe && !errores.fecha && Boolean(familiaId) && malEscritos === 0 && (sobra ?? 0) >= 0;

  const enviar = async () => {
    setIntentado(true);
    if (!valido || !familiaId || !total) return;
    await guardar.mutateAsync({ fecha, concepto: concepto.trim(), importeCentimos: total, medio, familiaId, asignaciones });
    navigate("/movimientos?ver=clasificados", { state: { aviso: "Pago apuntado." } });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4">
        <Link to="/movimientos" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> Movimientos
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Apuntar un pago a mano</h1>
          <p className="mt-1 text-suave">Para lo que no llega por el banco: efectivo, un Bizum a una cuenta personal…</p>
        </div>
      </div>

      <section className="grid gap-4 rounded-3xl bg-superficie p-4 ring-1 ring-linea sm:grid-cols-2 md:p-5">
        <Campo
          etiqueta="Quién ha pagado"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Lucía, en la reunión de padres"
          maxLength={120}
          error={intentado ? errores.concepto : undefined}
          className="sm:col-span-2"
        />
        <Campo etiqueta="Fecha" type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} error={intentado ? errores.fecha : undefined} />
        <CampoEuros etiqueta="Importe" value={importe} onChange={(e) => setImporte(e.target.value)} error={intentado ? errores.importe : undefined} />
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-semibold">Cómo se pagó</legend>
          <div className="flex flex-wrap gap-2">
            {MEDIOS.map((m) => (
              <label
                key={m.valor}
                className={cx(
                  "flex h-10 cursor-pointer items-center rounded-full px-4 text-sm font-semibold ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bosque",
                  medio === m.valor ? "bg-bosque text-fondo ring-bosque" : "bg-superficie text-suave ring-linea hover:text-tinta",
                )}
              >
                <input type="radio" name="medio" value={m.valor} checked={medio === m.valor} onChange={() => setMedio(m.valor)} className="sr-only" />
                {m.etiqueta}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <Reparto totalCentimos={total} familiaId={familiaId} onFamilia={setFamiliaId} importes={importes} onImportes={setImportes} />
      {intentado && !familiaId && <Aviso tono="error">Elige la familia que paga: busca a uno de sus niños.</Aviso>}

      {guardar.error && <Aviso tono="error">{mensajeDeError(guardar.error)}</Aviso>}
      <div className="sticky bottom-20 flex flex-col-reverse gap-2 rounded-3xl bg-superficie/95 p-3 ring-1 ring-linea backdrop-blur sm:flex-row sm:justify-end md:bottom-4">
        <Boton onClick={() => void enviar().catch(() => undefined)} cargando={guardar.isPending}>
          <CircleCheck className="size-4" aria-hidden /> Apuntar pago
        </Boton>
      </div>
    </div>
  );
};
