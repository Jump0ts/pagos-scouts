import { CircleCheck, Download, EllipsisVertical, PlusSquare, Share } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Boton } from "@/components/Boton";
import { estaInstalada, instalar, plataforma, usePuedeInstalar } from "./pwa.utils";

const Paso = ({ n, children }: { n: number; children: ReactNode }) => (
  <li className="flex gap-3">
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-bosque-claro text-sm font-bold text-bosque">{n}</span>
    <span className="pt-0.5">{children}</span>
  </li>
);

const Icono = ({ children }: { children: ReactNode }) => (
  <span className="mx-0.5 inline-grid size-6 place-items-center rounded-md bg-hundido align-[-5px] text-tinta">{children}</span>
);

// D-74: los pasos para instalar la app en el dispositivo que se esta usando.
export const GuiaInstalar = () => {
  const puede = usePuedeInstalar();
  const [instalando, setInstalando] = useState(false);
  const donde = plataforma();

  if (estaInstalada()) {
    return (
      <p className="flex items-center gap-2 text-sm">
        <CircleCheck className="size-5 text-bosque" aria-hidden /> Ya estás usando la app instalada.
      </p>
    );
  }

  const boton = puede && (
    <Boton
      cargando={instalando}
      onClick={async () => {
        setInstalando(true);
        await instalar().finally(() => setInstalando(false));
      }}
    >
      <Download className="size-4" aria-hidden /> Instalar la app
    </Boton>
  );

  if (donde === "ios") {
    return (
      <ol className="flex flex-col gap-3 text-sm">
        <Paso n={1}>
          Abre esta página en <strong>Safari</strong> y pulsa el botón Compartir{" "}
          <Icono>
            <Share className="size-4" aria-label="Compartir" />
          </Icono>
          .
        </Paso>
        <Paso n={2}>
          Baja y elige{" "}
          <strong>
            <Icono>
              <PlusSquare className="size-4" aria-hidden />
            </Icono>
            Añadir a pantalla de inicio
          </strong>
          .
        </Paso>
        <Paso n={3}>
          Pulsa <strong>Añadir</strong>. La app aparecerá con el icono de la tienda de campaña.
        </Paso>
      </ol>
    );
  }

  if (donde === "android") {
    return (
      boton || (
        <ol className="flex flex-col gap-3 text-sm">
          <Paso n={1}>
            Abre el menú del navegador{" "}
            <Icono>
              <EllipsisVertical className="size-4" aria-label="Menú" />
            </Icono>
            .
          </Paso>
          <Paso n={2}>
            Pulsa <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
          </Paso>
        </ol>
      )
    );
  }

  return (
    boton || (
      <p className="text-sm text-suave">
        En el ordenador, Chrome y Edge la pueden instalar desde el icono de instalar de la barra de direcciones. En el móvil es
        donde más se nota: ábrela allí para ver los pasos.
      </p>
    )
  );
};
