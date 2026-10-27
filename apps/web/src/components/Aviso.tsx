import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

const TONOS = {
  error: { clase: "bg-rojo-claro text-rojo", icono: CircleAlert },
  exito: { clase: "bg-bosque-claro text-bosque", icono: CircleCheck },
  info: { clase: "bg-azul-claro text-azul", icono: Info },
} as const;

export const Aviso = ({ tono = "info", children }: { tono?: keyof typeof TONOS; children: ReactNode }) => {
  const { clase, icono: Icono } = TONOS[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={cx("flex gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium", clase)}>
      <Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
};
