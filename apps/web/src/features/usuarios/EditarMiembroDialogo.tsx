import { useEffect, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Dialogo } from "@/components/Dialogo";
import type { Rol } from "@/features/auth/auth.types";
import { ApiError, mensajeDeError } from "@/utils/api";
import { useEditarMiembro } from "./usuarios.api";
import type { Miembro } from "./usuarios.types";
import { RolYSecciones } from "./RolYSecciones";

type Props = { miembro: Miembro | null; onCerrar: () => void };

export const EditarMiembroDialogo = ({ miembro, onCerrar }: Props) => {
  const editar = useEditarMiembro();
  const [rol, setRol] = useState<Rol | undefined>();
  const [seccionIds, setSeccionIds] = useState<string[]>([]);
  const [errorSecciones, setErrorSecciones] = useState<string>();

  useEffect(() => {
    if (miembro) {
      setRol(miembro.rol);
      setSeccionIds(miembro.seccionIds);
      setErrorSecciones(undefined);
      editar.reset();
    }
    // editar.reset es estable; solo se reinicia al abrir con otra persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miembro]);

  if (!miembro) return null;

  const guardar = async () => {
    if (!rol) return;
    if (rol === "SCOUTER" && seccionIds.length === 0) {
      setErrorSecciones("Elige al menos una sección");
      return;
    }
    try {
      await editar.mutateAsync({ membresiaId: miembro.membresiaId, rol, seccionIds: rol === "SCOUTER" ? seccionIds : [] });
      onCerrar();
    } catch (error) {
      if (error instanceof ApiError && error.campos?.seccionIds) setErrorSecciones(error.campos.seccionIds);
    }
  };

  return (
    <Dialogo
      abierto
      onCambiar={(v) => !v && onCerrar()}
      titulo={`Rol de ${miembro.usuario.nombre}`}
      descripcion={miembro.esTuCuenta ? "Es tu cuenta: si dejas de ser administrador, perderás acceso a esta pantalla." : undefined}
    >
      <div className="flex flex-col gap-5">
        {editar.error && !(editar.error instanceof ApiError && editar.error.campos) && (
          <Aviso tono="error">{mensajeDeError(editar.error)}</Aviso>
        )}
        <RolYSecciones
          rol={rol}
          onRol={setRol}
          seccionIds={seccionIds}
          onSecciones={(ids) => {
            setSeccionIds(ids);
            setErrorSecciones(undefined);
          }}
          errorSecciones={errorSecciones}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton cargando={editar.isPending} onClick={guardar}>Guardar</Boton>
        </div>
      </div>
    </Dialogo>
  );
};
