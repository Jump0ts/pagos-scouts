import { LoaderCircle } from "lucide-react";

export const Cargando = ({ texto = "Cargando…" }: { texto?: string }) => (
  <div role="status" className="flex items-center justify-center gap-2 py-16 text-suave">
    <LoaderCircle className="size-5 animate-spin" aria-hidden />
    <span>{texto}</span>
  </div>
);
