import { GuiaInstalar } from "./GuiaInstalar";

// D-74: los pasos para instalar la app, siempre a mano en Ajustes.
export const InstalarAjustes = () => (
  <section className="flex max-w-xl flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
    <div>
      <h2 className="font-display text-xl font-bold">Instalar la app</h2>
      <p className="text-sm text-suave">
        Se abre como una app más, a pantalla completa y al instante. Los datos nunca se guardan en el móvil: siempre se piden
        al servidor.
      </p>
    </div>
    <GuiaInstalar />
  </section>
);
