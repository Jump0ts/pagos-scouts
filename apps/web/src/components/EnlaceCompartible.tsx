import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { Boton } from "./Boton";

type Props = { enlace: string; mensaje: string; caducidad: string };

const sePuedeCompartir = (datos: ShareData) =>
  typeof navigator !== "undefined" && typeof navigator.share === "function" && (navigator.canShare?.(datos) ?? true);

// D-25: la app nunca envia nada; quien la usa copia el enlace o lo comparte con el menu del sistema (WhatsApp...).
export const EnlaceCompartible = ({ enlace, mensaje, caducidad }: Props) => {
  const [copiado, setCopiado] = useState(false);
  const datos = { text: `${mensaje} ${enlace}` };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso para el portapapeles: se selecciona el texto para copiarlo a mano.
      document.getElementById("enlace-compartible")?.focus();
    }
  };

  const compartir = () => navigator.share(datos).catch(() => undefined);

  return (
    <div className="flex flex-col gap-3">
      <input
        id="enlace-compartible"
        readOnly
        value={enlace}
        aria-label="Enlace"
        onFocus={(e) => e.currentTarget.select()}
        className="h-12 w-full truncate rounded-2xl bg-hundido px-4 font-mono text-sm ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
      />
      <p className="text-sm text-suave">{caducidad}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Boton variante={sePuedeCompartir(datos) ? "secundario" : "primario"} onClick={copiar} className="flex-1">
          {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copiado ? "Copiado" : "Copiar enlace"}
        </Boton>
        {sePuedeCompartir(datos) && (
          <Boton onClick={compartir} className="flex-1">
            <Share2 className="size-4" aria-hidden /> Compartir
          </Boton>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {copiado ? "Enlace copiado" : ""}
      </span>
    </div>
  );
};
