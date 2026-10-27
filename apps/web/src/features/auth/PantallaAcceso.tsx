import { Tent } from "lucide-react";
import type { ReactNode } from "react";

// D-22: tarjeta centrada para login, invitaciones y restablecer contraseña.
export const PantallaAcceso = ({ titulo, subtitulo, children, pie }: {
  titulo: string;
  subtitulo?: ReactNode;
  children: ReactNode;
  pie?: ReactNode;
}) => (
  <div
    className="grid min-h-dvh place-items-center py-10"
    style={{ paddingInline: "max(16px, env(safe-area-inset-left))" }}
  >
    <main className="w-full max-w-sm">
      <div className="mb-6 flex items-center justify-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-bosque text-fondo">
          <Tent className="size-5" aria-hidden />
        </span>
        <span className="font-display text-xl font-bold">Tesorería</span>
      </div>
      <section className="rounded-3xl bg-superficie p-6 ring-1 ring-linea sm:p-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-balance">{titulo}</h1>
        {subtitulo && <p className="mt-1.5 text-suave">{subtitulo}</p>}
        <div className="mt-6">{children}</div>
      </section>
      {pie && <div className="mt-5 text-center text-sm text-suave">{pie}</div>}
    </main>
  </div>
);
