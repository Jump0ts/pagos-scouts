import { FileSpreadsheet, Upload } from "lucide-react";
import { useState, type DragEvent } from "react";
import { cx } from "@/utils/cx";

type Props = {
  titulo: string;
  tituloCargando: string;
  onArchivo: (archivo: File) => void;
  cargando: boolean;
};

// Zona para elegir o arrastrar un Excel (o CSV). El fichero se manda a la API, que lo lee en memoria.
export const SubirArchivo = ({ titulo, tituloCargando, onArchivo, cargando }: Props) => {
  const [encima, setEncima] = useState(false);
  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setEncima(false);
    const archivo = e.dataTransfer.files[0];
    if (archivo && !cargando) onArchivo(archivo);
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
      className={cx(
        "flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-10 text-center transition-colors",
        encima ? "border-bosque bg-bosque-claro" : "border-linea bg-superficie hover:border-bosque",
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-bosque-claro text-bosque">
        {cargando ? <FileSpreadsheet className="size-6 animate-pulse" aria-hidden /> : <Upload className="size-6" aria-hidden />}
      </span>
      <span className="font-display text-xl font-bold">{cargando ? tituloCargando : titulo}</span>
      <span className="text-sm text-suave">o arrástralo aquí · .xlsx, .xls o .csv</span>
      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        className="sr-only"
        disabled={cargando}
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) onArchivo(archivo);
          e.target.value = "";
        }}
      />
    </label>
  );
};
