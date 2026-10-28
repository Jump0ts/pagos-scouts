import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Boton } from "@/components/Boton";
import { Dialogo } from "@/components/Dialogo";

type Props = { abierto: boolean; onCambiar: (abierto: boolean) => void; texto: string; faltan: number };

const sePuedeCompartir = (texto: string) =>
  typeof navigator !== "undefined" && typeof navigator.share === "function" && (navigator.canShare?.({ text: texto }) ?? true);

// D-58 y D-25: la app no envía nada; se ve el texto antes, y se copia o se comparte con el menú del sistema.
export const RecordatorioDialogo = ({ abierto, onCambiar, texto, faltan }: Props) => {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso para el portapapeles: se selecciona el texto para copiarlo a mano.
      const caja = document.getElementById("texto-recordatorio") as HTMLTextAreaElement | null;
      caja?.focus();
      caja?.select();
    }
  };

  return (
    <Dialogo
      abierto={abierto}
      onCambiar={onCambiar}
      titulo="Recordatorio de pago"
      descripcion={`${faltan} ${faltan === 1 ? "niño" : "niños"} con los filtros de ahora. Sin importes, para el grupo de familias.`}
    >
      <div className="flex flex-col gap-3">
        <textarea
          id="texto-recordatorio"
          readOnly
          value={texto}
          aria-label="Texto del recordatorio"
          rows={Math.min(12, texto.split("\n").length)}
          className="w-full resize-none rounded-2xl bg-hundido p-4 text-sm ring-1 ring-linea focus:ring-2 focus:ring-bosque focus:outline-none"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Boton variante={sePuedeCompartir(texto) ? "secundario" : "primario"} onClick={copiar} className="sm:flex-1">
            {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copiado ? "Copiado" : "Copiar texto"}
          </Boton>
          {sePuedeCompartir(texto) && (
            <Boton onClick={() => navigator.share({ text: texto }).catch(() => undefined)} className="sm:flex-1">
              <Share2 className="size-4" aria-hidden /> Compartir
            </Boton>
          )}
        </div>
        <span className="sr-only" aria-live="polite">
          {copiado ? "Texto copiado" : ""}
        </span>
      </div>
    </Dialogo>
  );
};
