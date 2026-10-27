import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { Aviso } from "./Aviso";
import { Boton } from "./Boton";
import { mensajeDeError } from "@/utils/api";

type Props = {
  abierto: boolean;
  onCambiar: (abierto: boolean) => void;
  titulo: string;
  descripcion: string;
  accion: string;
  peligrosa?: boolean;
  onConfirmar: () => Promise<unknown>;
};

// Confirmacion antes de algo que no se puede deshacer facilmente (quitar a alguien, retirar una invitacion).
export const Confirmar = ({ abierto, onCambiar, titulo, descripcion, accion, peligrosa = false, onConfirmar }: Props) => {
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmar = async () => {
    setEnCurso(true);
    setError(null);
    try {
      await onConfirmar();
      onCambiar(false);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnCurso(false);
    }
  };

  return (
    <AlertDialog.Root open={abierto} onOpenChange={(v) => { setError(null); onCambiar(v); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-tinta/40 backdrop-blur-[2px]" />
        <AlertDialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-3xl bg-superficie p-6 shadow-2xl ring-1 ring-linea">
          <AlertDialog.Title className="font-display text-xl font-bold text-balance">{titulo}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-suave">{descripcion}</AlertDialog.Description>
          {error && (
            <div className="mt-4">
              <Aviso tono="error">{error}</Aviso>
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Boton variante="secundario">Cancelar</Boton>
            </AlertDialog.Cancel>
            <Boton variante={peligrosa ? "peligro" : "primario"} cargando={enCurso} onClick={confirmar}>
              {accion}
            </Boton>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};
