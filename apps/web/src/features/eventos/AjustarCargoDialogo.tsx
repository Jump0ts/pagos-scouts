import { useEffect, useState, type FormEvent } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { CampoEuros } from "@/components/CampoEuros";
import { Dialogo } from "@/components/Dialogo";
import { mensajeDeError } from "@/utils/api";
import { aCentimos, aTextoEuros, euros } from "@/utils/dinero";
import { useAjustarCargo } from "./eventos.api";
import type { CargoVista } from "./eventos.types";

type Props = { eventoId: string; cargo: CargoVista | null; onCerrar: () => void };

// D-35: importe ajustado a mano (0 € = exento) con un motivo opcional, o volver al calculado.
export const AjustarCargoDialogo = ({ eventoId, cargo, onCerrar }: Props) => {
  const ajustar = useAjustarCargo();
  const [importe, setImporte] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!cargo) return;
    setImporte(aTextoEuros(cargo.importeCentimos));
    setMotivo(cargo.motivoAjuste ?? "");
    setError(undefined);
    ajustar.reset();
    // ajustar.reset es estable; se reinicia al abrir con otro cargo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargo]);

  if (!cargo) return null;

  const guardar = async (centimos: number | null) => {
    await ajustar.mutateAsync({ eventoId, cargoId: cargo.id, importeAjustadoCentimos: centimos, motivo: centimos === null ? null : motivo });
    onCerrar();
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const centimos = aCentimos(importe);
    if (centimos === null) {
      setError("Escribe un importe, por ejemplo 85 o 0 si está exento");
      return;
    }
    await guardar(centimos).catch(() => undefined);
  };

  return (
    <Dialogo
      abierto
      onCambiar={(v) => !v && onCerrar()}
      titulo={`Importe de ${cargo.educando.nombre}`}
      descripcion={`Según los precios del evento le corresponden ${euros(cargo.importeCalculadoCentimos)}. Pon 0 si está exento.`}
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {ajustar.error && <Aviso tono="error">{mensajeDeError(ajustar.error)}</Aviso>}
        <CampoEuros etiqueta="Importe" autoFocus value={importe} onChange={(e) => setImporte(e.target.value)} error={error} className="max-w-48" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="motivo-ajuste" className="text-sm font-semibold">Motivo (opcional)</label>
          <textarea
            id="motivo-ajuste"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            rows={2}
            aria-describedby="motivo-ajuste-ayuda"
            className="rounded-2xl bg-superficie px-4 py-3 text-base ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
          />
          <p id="motivo-ajuste-ayuda" className="text-sm text-suave">
            Solo lo ven administración y tesorería. Evita datos de salud o de situación familiar.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {cargo.ajustado ? (
            <Boton variante="fantasma" onClick={() => void guardar(null).catch(() => undefined)} disabled={ajustar.isPending}>
              Volver a {euros(cargo.importeCalculadoCentimos)}
            </Boton>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
            <Boton type="submit" cargando={ajustar.isPending}>Guardar</Boton>
          </div>
        </div>
      </form>
    </Dialogo>
  );
};
