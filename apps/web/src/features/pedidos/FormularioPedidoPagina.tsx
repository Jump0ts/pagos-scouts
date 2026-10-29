import { useQuery } from "@tanstack/react-query";
import { CircleCheck, ShieldCheck, Tent } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Cargando } from "@/components/Cargando";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { EleccionArticulos } from "./EleccionArticulos";
import { codigoDelEnlace, enviarPedido, leerFormulario } from "./pedidoPublico.api";
import type { FormularioPublico, LineaEntrada, ResumenEnvio } from "./pedidos.types";
import { describirLinea, NOMBRE_SEGURO, precioDe, problemaDe } from "./pedidos.utils";

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });

const Marco = ({ grupo, children }: { grupo?: string; children: ReactNode }) => (
  <div className="min-h-dvh" style={{ paddingInline: "max(16px, env(safe-area-inset-left))" }}>
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 pt-6 pb-36">
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-xl bg-bosque text-fondo">
          <Tent className="size-5" aria-hidden />
        </span>
        <span className="font-display text-lg font-bold">{grupo ?? "Tesorería"}</span>
      </div>
      {children}
    </main>
  </div>
);

type Errores = { nombre?: string; apellidos?: string; seccionId?: string; lineas?: string; porLinea: (string | null)[] };

const validar = (f: FormularioPublico, datos: { nombre: string; apellidos: string; seccionId: string; lineas: LineaEntrada[] }): Errores | null => {
  const errores: Errores = { porLinea: [] };
  const nombre = (texto: string) => (!texto.trim() ? "Escríbelo" : NOMBRE_SEGURO.test(texto.trim()) ? undefined : "Usa solo letras");
  errores.nombre = nombre(datos.nombre);
  errores.apellidos = nombre(datos.apellidos);
  if (!datos.seccionId) errores.seccionId = "Elige su sección";
  if (!datos.lineas.length) errores.lineas = "Añade al menos un artículo";
  errores.porLinea = datos.lineas.map((l) => {
    const articulo = f.articulos.find((a) => a.id === l.articuloId);
    return articulo ? problemaDe(articulo, l) : "Artículo no válido";
  });
  const hay = errores.nombre || errores.apellidos || errores.seccionId || errores.lineas || errores.porLinea.some(Boolean);
  return hay ? errores : null;
};

// D-67: formulario publico de un pedido. Se abre con el enlace que comparte el grupo; el codigo va detras del #.
export const FormularioPedidoPagina = () => {
  const [codigo] = useState(codigoDelEnlace);
  const { data: f, isPending, error } = useQuery({
    queryKey: ["pedido-publico", codigo],
    queryFn: () => leerFormulario(codigo),
    enabled: Boolean(codigo),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [seccionId, setSeccionId] = useState("");
  const [lineas, setLineas] = useState<LineaEntrada[]>([]);
  // Campo trampa (D-69): invisible para las personas; si llega relleno, la API lo descarta.
  const [web, setWeb] = useState("");
  const [errores, setErrores] = useState<Errores | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [hecho, setHecho] = useState<ResumenEnvio | null>(null);

  if (!codigo) {
    return (
      <Marco>
        <Aviso tono="error">Este enlace está incompleto. Ábrelo tal como te lo ha mandado tu grupo.</Aviso>
      </Marco>
    );
  }
  if (isPending) return <Cargando />;
  if (error || !f) {
    return (
      <Marco>
        <Aviso tono="error">{mensajeDeError(error)}</Aviso>
      </Marco>
    );
  }

  const total = lineas.reduce((n, l) => {
    const articulo = f.articulos.find((a) => a.id === l.articuloId);
    return n + (articulo ? precioDe(articulo, l) : 0);
  }, 0);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErrorEnvio(null);
    const problemas = validar(f, { nombre, apellidos, seccionId, lineas });
    setErrores(problemas);
    if (problemas) return;
    setEnviando(true);
    try {
      setHecho(await enviarPedido({ enlace: codigo, ticket: f.ticket, web, nombre: nombre.trim(), apellidos: apellidos.trim(), seccionId, lineas }));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setErrorEnvio(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const otraPersona = () => {
    setHecho(null);
    setNombre("");
    setApellidos("");
    setLineas([]);
    setErrores(null);
    window.scrollTo({ top: 0 });
  };

  if (hecho) {
    return (
      <Marco grupo={f.grupo}>
        <section className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea sm:p-6">
          <div className="flex items-center gap-3">
            <CircleCheck className="size-8 shrink-0 text-bosque" aria-hidden />
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Pedido enviado</h1>
              <p className="text-suave">Para {hecho.resumen.nombre}</p>
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-linea rounded-2xl bg-hundido px-4">
            {hecho.resumen.lineas.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span>{describirLinea(l.articulo, l.elecciones)}</span>
                <span className="font-semibold tabular-nums">{euros(l.importeCentimos)}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-baseline justify-between font-display text-xl font-bold">
            <span>Total</span>
            <span className="tabular-nums">{euros(hecho.resumen.totalCentimos)}</span>
          </p>
          {hecho.instruccionesPago && (
            <div className="rounded-2xl bg-ambar-claro p-4">
              <h2 className="text-sm font-bold">Cómo pagarlo</h2>
              <p className="mt-1 text-sm whitespace-pre-line">{hecho.instruccionesPago}</p>
            </div>
          )}
          <p className="text-sm text-suave">
            Tesorería revisará el pedido. Si te has equivocado, envía otro con lo correcto y avísales: se quedarán con el último.
          </p>
          <Boton variante="secundario" onClick={otraPersona}>
            Pedir para otra persona
          </Boton>
        </section>
      </Marco>
    );
  }

  return (
    <Marco grupo={f.grupo}>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance">{f.pedido.nombre}</h1>
        <p className="text-suave">Puedes hacer el pedido hasta el {fechaLarga(f.pedido.fechaFin)}.</p>
      </div>

      <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <section aria-labelledby="para-quien" className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
          <h2 id="para-quien" className="font-display text-xl font-bold">
            ¿Para quién es?
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} error={errores?.nombre} />
            <Campo etiqueta="Apellidos" autoComplete="off" value={apellidos} onChange={(e) => setApellidos(e.target.value)} maxLength={80} error={errores?.apellidos} />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Sección</legend>
            <div role="radiogroup" aria-label="Sección" className="flex flex-wrap gap-1.5">
              {f.secciones.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={seccionId === s.id}
                  onClick={() => setSeccionId(s.id)}
                  className={cx(
                    "min-h-10 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
                    seccionId === s.id ? "bg-bosque text-fondo ring-bosque" : "bg-hundido ring-transparent hover:ring-linea",
                  )}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
            {errores?.seccionId && <p className="text-sm font-medium text-rojo">{errores.seccionId}</p>}
          </fieldset>
          {/* D-69: campo trampa, fuera de la vista y del teclado. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label>
              Deja este campo vacío
              <input type="text" name="web" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
            </label>
          </div>
        </section>

        <section aria-labelledby="que-quieres" className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
          <h2 id="que-quieres" className="font-display text-xl font-bold">
            ¿Qué quieres?
          </h2>
          <EleccionArticulos articulos={f.articulos} lineas={lineas} onCambiar={setLineas} errores={errores?.porLinea} />
          {errores?.lineas && <p className="text-sm font-medium text-rojo">{errores.lineas}</p>}
        </section>

        <details className="group rounded-3xl bg-superficie p-5 text-sm ring-1 ring-linea">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-bosque" aria-hidden /> Cómo tratamos estos datos
          </summary>
          <div className="mt-3 flex flex-col gap-2 text-suave">
            <p>
              <strong className="text-tinta">Responsable:</strong> {f.grupo}.
            </p>
            <p>
              <strong className="text-tinta">Para qué:</strong> preparar este pedido, encargarlo y cobrarlo. Solo lo ven quienes
              llevan la tesorería del grupo y los scouters de su sección.
            </p>
            <p>
              <strong className="text-tinta">Qué guardamos:</strong> el nombre, los apellidos y la sección de quien recibe el pedido, y lo
              que se pide. No pedimos correo ni teléfono.
            </p>
            <p>
              <strong className="text-tinta">Cuánto tiempo:</strong> lo aceptado se guarda con las cuentas del grupo; un envío que no se
              acepta se borra en cuanto se revisa, y como mucho 30 días después de cerrar el pedido.
            </p>
            <p>
              <strong className="text-tinta">Tus derechos:</strong> puedes pedir al grupo ver, corregir o borrar estos datos.
            </p>
          </div>
        </details>

        {errorEnvio && <Aviso tono="error">{errorEnvio}</Aviso>}

        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-superficie/95 backdrop-blur"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4 px-4 pt-3">
            <p className="flex flex-col">
              <span className="text-xs text-suave">Total</span>
              <span className="font-display text-2xl font-bold tabular-nums" aria-live="polite">
                {euros(total)}
              </span>
            </p>
            <Boton type="submit" cargando={enviando} className="min-w-40">
              Enviar pedido
            </Boton>
          </div>
        </div>
      </form>
    </Marco>
  );
};
