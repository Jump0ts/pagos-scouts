import { Smartphone, X } from "lucide-react";
import { useState } from "react";
import { Boton } from "@/components/Boton";
import { Dialogo } from "@/components/Dialogo";
import { GuiaInstalar } from "./GuiaInstalar";
import { estaInstalada, guardarPreferencia, leerPreferencia, plataforma } from "./pwa.utils";

const CERRADA = "pagos-scouts:instalar-cerrada";

// D-74: en Inicio, solo en el movil y si aun no esta instalada. Se puede cerrar; los pasos siguen en Ajustes.
export const TarjetaInstalar = () => {
  const [cerrada, setCerrada] = useState(() => leerPreferencia(CERRADA) === "1");
  const [abierta, setAbierta] = useState(false);
  if (cerrada || estaInstalada() || plataforma() === "escritorio") return null;

  const cerrar = () => {
    guardarPreferencia(CERRADA, "1");
    setCerrada(true);
  };

  return (
    <section aria-labelledby="instalar-titulo" className="relative flex items-center gap-4 rounded-3xl bg-bosque-claro p-5 pr-12">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-bosque text-fondo">
        <Smartphone className="size-6" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <div>
          <h2 id="instalar-titulo" className="font-display text-lg font-bold">
            Tenla a mano en tu móvil
          </h2>
          <p className="text-sm text-tinta/80">Instálala y se abrirá como una app más, a pantalla completa.</p>
        </div>
        <Boton tamano="pequeno" onClick={() => setAbierta(true)}>
          Cómo instalarla
        </Boton>
      </div>
      <button
        type="button"
        onClick={cerrar}
        aria-label="No mostrar más"
        className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-suave hover:bg-superficie hover:text-tinta"
      >
        <X className="size-4" aria-hidden />
      </button>
      <Dialogo abierto={abierta} onCambiar={setAbierta} titulo="Instalar la app" descripcion="Así la tendrás en tu pantalla de inicio.">
        <GuiaInstalar />
      </Dialogo>
    </section>
  );
};
