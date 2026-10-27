import { ChevronRight, Inbox } from "lucide-react";
import { Link } from "react-router";
import { ETIQUETA_ROL } from "@/features/auth/auth.constants";
import { usePerfil } from "@/features/auth/useSesion";
import { EstadoSistema } from "@/features/health/EstadoSistema";
import { useMovimientos } from "@/features/movimientos/movimientos.api";

// Los pagos que esperan una decisión (D-5). Solo para quien ve los movimientos del banco (D-16).
const TarjetaDudas = () => {
  const { data } = useMovimientos("DUDA");
  if (!data) return null;
  const dudas = data.contadores.dudas;
  return (
    <Link
      to="/movimientos"
      className="flex items-center gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea transition hover:ring-bosque md:p-6"
    >
      <span className={dudas ? "grid size-12 shrink-0 place-items-center rounded-2xl bg-ambar-claro text-tinta" : "grid size-12 shrink-0 place-items-center rounded-2xl bg-bosque-claro text-bosque"}>
        <Inbox className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-bold">
          {dudas ? `${dudas} ${dudas === 1 ? "duda" : "dudas"} por resolver` : "Sin dudas"}
        </span>
        <span className="text-sm text-suave">
          {dudas ? "Pagos del banco que necesitan tu decisión." : "Todo lo importado del banco está clasificado."}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-suave" aria-hidden />
    </Link>
  );
};

export const InicioPagina = () => {
  const { usuario, grupoActivo } = usePerfil();
  const nombrePila = usuario.nombre.split(/\s+/)[0];
  const gestiona = grupoActivo?.rol === "ADMIN" || grupoActivo?.rol === "TESORERIA";

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

      {gestiona && <TarjetaDudas />}

      <EstadoSistema />
    </div>
  );
};
