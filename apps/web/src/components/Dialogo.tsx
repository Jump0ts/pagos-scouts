import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  abierto: boolean;
  onCambiar: (abierto: boolean) => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
};

// D-7b: Radix pone foco, teclado y lectores de pantalla; el aspecto es el nuestro. En el movil sube desde abajo
// como una hoja; en escritorio aparece centrado.
export const Dialogo = ({ abierto, onCambiar, titulo, descripcion, children }: Props) => (
  <RadixDialog.Root open={abierto} onOpenChange={onCambiar}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-tinta/40 backdrop-blur-[2px] data-[state=open]:animate-[fundido-entra_200ms_var(--ease-salida)] data-[state=closed]:animate-[fundido-sale_150ms_var(--ease-salida)]" />
      <RadixDialog.Content
        className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-superficie p-5 shadow-2xl ring-1 ring-linea sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-6 data-[state=open]:animate-[hoja-entra_280ms_var(--ease-hoja)] data-[state=closed]:animate-[hoja-sale_200ms_var(--ease-hoja)] sm:data-[state=open]:animate-[dialogo-entra_200ms_var(--ease-salida)] sm:data-[state=closed]:animate-[fundido-sale_150ms_var(--ease-salida)]"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <RadixDialog.Title className="font-display text-xl font-bold text-balance">{titulo}</RadixDialog.Title>
            {descripcion ? (
              <RadixDialog.Description className="mt-1 text-sm text-suave">{descripcion}</RadixDialog.Description>
            ) : (
              <RadixDialog.Description className="sr-only">{titulo}</RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close
            aria-label="Cerrar"
            className="grid size-9 shrink-0 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
          >
            <X className="size-5" aria-hidden />
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>
);
