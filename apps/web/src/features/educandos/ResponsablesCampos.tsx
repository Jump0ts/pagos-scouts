import { Plus, X } from "lucide-react";
import { useId } from "react";

type Props = { valor: string[]; onCambiar: (responsables: string[]) => void; errores?: (string | undefined)[] };

const MAXIMO = 6;

// D-27: de los responsables solo el nombre completo. Una casilla por persona.
export const ResponsablesCampos = ({ valor, onCambiar, errores = [] }: Props) => {
  const id = useId();
  const filas = valor.length ? valor : [""];

  const cambiar = (i: number, texto: string) => onCambiar(filas.map((v, j) => (j === i ? texto : v)));
  const quitar = (i: number) => onCambiar(filas.filter((_, j) => j !== i));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">Padres, madres o tutores</legend>
      <p id={`${id}-ayuda`} className="-mt-1 text-sm text-suave">
        Nombre y apellidos completos: es lo que la app busca en el Excel del banco para saber quién paga.
      </p>
      {filas.map((texto, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              value={texto}
              onChange={(e) => cambiar(i, e.target.value)}
              aria-label={`Responsable ${i + 1}`}
              aria-describedby={`${id}-ayuda`}
              aria-invalid={errores[i] ? true : undefined}
              autoComplete="off"
              placeholder="Nombre Apellido Apellido"
              className="h-12 min-w-0 flex-1 rounded-2xl bg-superficie px-4 text-base ring-1 ring-linea placeholder:text-suave focus:outline-none focus:ring-2 focus:ring-bosque"
            />
            {filas.length > 1 && (
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={`Quitar responsable ${i + 1}`}
                className="grid size-10 shrink-0 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {errores[i] && <p className="text-sm font-medium text-rojo">{errores[i]}</p>}
        </div>
      ))}
      {filas.length < MAXIMO && (
        <button
          type="button"
          onClick={() => onCambiar([...filas, ""])}
          className="flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-bosque hover:bg-bosque-claro"
        >
          <Plus className="size-4" aria-hidden /> Añadir otra persona
        </button>
      )}
    </fieldset>
  );
};
