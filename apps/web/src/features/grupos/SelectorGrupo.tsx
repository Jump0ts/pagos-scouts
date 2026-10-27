import * as Menu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { ETIQUETA_ROL } from "@/features/auth/auth.constants";
import { useCambiarGrupo, usePerfil } from "@/features/auth/useSesion";

// D-23: el grupo activo siempre visible bajo "Tesorería"; con varios grupos, un menú para cambiar.
export const SelectorGrupo = () => {
  const { grupos, grupoActivo } = usePerfil();
  const cambiar = useCambiarGrupo();
  const nombre = grupoActivo?.nombre ?? "Sin grupo";

  if (grupos.length <= 1) return <span className="block truncate text-xs text-suave">{nombre}</span>;

  return (
    <Menu.Root>
      <Menu.Trigger
        className="-ml-1 flex max-w-[60vw] items-center gap-1 rounded-md px-1 text-xs font-semibold text-suave hover:text-tinta sm:max-w-xs"
        aria-label={`Grupo activo: ${nombre}. Cambiar de grupo`}
      >
        <span className="truncate">{nombre}</span>
        <ChevronDown className="size-3.5 shrink-0" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={8}
          className="z-50 min-w-64 rounded-2xl bg-superficie p-1.5 shadow-xl ring-1 ring-linea"
        >
          <Menu.Label className="px-3 py-2 text-xs font-bold uppercase tracking-[.12em] text-suave">Tus grupos</Menu.Label>
          {grupos.map((grupo) => {
            const activo = grupo.id === grupoActivo?.id;
            return (
              <Menu.Item
                key={grupo.id}
                disabled={cambiar.isPending}
                onSelect={() => !activo && cambiar.mutate(grupo.id)}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hundido"
              >
                <span className="grid size-4 place-items-center">{activo && <Check className="size-4 text-bosque" aria-hidden />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{grupo.nombre}</span>
                  <span className="text-xs text-suave">{ETIQUETA_ROL[grupo.rol]}</span>
                </span>
              </Menu.Item>
            );
          })}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
};
