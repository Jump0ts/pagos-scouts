import { Tent } from "lucide-react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { ETIQUETA_ROL } from "@/features/auth/auth.constants";
import { useCambiarGrupo, usePerfil } from "@/features/auth/useSesion";
import { mensajeDeError } from "@/utils/api";

// Cuando el grupo activo ya no es tuyo (te han quitado, o has salido): eliges otro o se explica que hacer.
export const SinGrupo = () => {
  const { grupos } = usePerfil();
  const cambiar = useCambiarGrupo();

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl bg-superficie p-8 text-center ring-1 ring-linea">
      <span className="grid size-12 place-items-center rounded-2xl bg-hundido text-suave">
        <Tent className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-bold text-balance">
        {grupos.length > 0 ? "Elige un grupo" : "No estás en ningún grupo"}
      </h1>
      {grupos.length === 0 ? (
        <p className="text-suave">Para volver a entrar, pide a un administrador de tu grupo que te invite de nuevo.</p>
      ) : (
        <ul className="flex w-full flex-col gap-2">
          {grupos.map((g) => (
            <li key={g.id}>
              <Boton variante="secundario" className="w-full justify-between" cargando={cambiar.isPending} onClick={() => cambiar.mutate(g.id)}>
                <span className="truncate">{g.nombre}</span>
                <span className="text-xs text-suave">{ETIQUETA_ROL[g.rol]}</span>
              </Boton>
            </li>
          ))}
        </ul>
      )}
      {cambiar.error && <Aviso tono="error">{mensajeDeError(cambiar.error)}</Aviso>}
    </section>
  );
};
