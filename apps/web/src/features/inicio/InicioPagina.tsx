import { CalendarDays, Inbox } from "lucide-react";
import { ETIQUETA_ROL } from "@/features/auth/auth.constants";
import { usePerfil } from "@/features/auth/useSesion";
import { EstadoSistema } from "@/features/health/EstadoSistema";

const PROXIMAMENTE = [
  { icono: Inbox, titulo: "Dudas", texto: "Los pagos que necesitan tu decisión." },
  { icono: CalendarDays, titulo: "Eventos", texto: "Cuotas y actividades, y quién ha pagado." },
];

export const InicioPagina = () => {
  const { usuario, grupoActivo } = usePerfil();
  const nombrePila = usuario.nombre.split(/\s+/)[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance">Hola, {nombrePila}</h1>
        {grupoActivo && (
          <p className="mt-1 text-suave">
            {grupoActivo.nombre} · {ETIQUETA_ROL[grupoActivo.rol]}
          </p>
        )}
      </div>

      <section aria-labelledby="proximamente" className="rounded-3xl bg-superficie p-5 ring-1 ring-linea md:p-6">
        <h2 id="proximamente" className="font-display text-xl font-bold">Lo que viene</h2>
        <p className="text-sm text-suave">Estas pantallas llegan en las siguientes partes.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PROXIMAMENTE.map(({ icono: Icono, titulo, texto }) => (
            <li key={titulo} className="flex gap-3 rounded-2xl bg-hundido p-4">
              <Icono className="mt-0.5 size-5 shrink-0 text-bosque" aria-hidden />
              <span>
                <span className="block font-semibold">{titulo}</span>
                <span className="text-sm text-suave">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <EstadoSistema />
    </div>
  );
};
