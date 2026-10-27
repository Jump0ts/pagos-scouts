import { Tent } from "lucide-react";
import { EstadoSistema } from "./features/health/EstadoSistema";

// Parte 0: el esqueleto. Las pantallas reales (Dudas, Eventos, Educandos...) llegan en las siguientes partes.
export const App = () => (
  <div className="min-h-dvh" style={{ paddingInline: "max(16px, env(safe-area-inset-left))" }}>
    <header className="mx-auto flex h-16 max-w-3xl items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-bosque text-fondo">
        <Tent className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold">Tesorería</span>
        <span className="block text-xs text-suave">Pagos Scouts</span>
      </span>
    </header>

    <main className="mx-auto flex max-w-3xl flex-col gap-6 pt-6 pb-12">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.14em] text-bosque">Parte 0 · Esqueleto</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-balance">La tesorería está en obras</h1>
        <p className="mt-2 max-w-prose text-suave">
          La base ya está montada: web, API y base de datos. Las pantallas de Dudas, Eventos y Educandos llegarán en
          las siguientes partes.
        </p>
      </div>
      <EstadoSistema />
    </main>
  </div>
);
