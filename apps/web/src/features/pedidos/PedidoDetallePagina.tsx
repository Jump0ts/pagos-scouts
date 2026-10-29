import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, Ellipsis, FileSpreadsheet, Inbox, Lock, LockOpen, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { BarraProgreso } from "@/components/BarraProgreso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { Confirmar } from "@/components/Confirmar";
import { EnlaceCompartible } from "@/components/EnlaceCompartible";
import { usePerfil } from "@/features/auth/useSesion";
import { useBorrarEvento } from "@/features/eventos/eventos.api";
import { ESTADOS } from "@/features/eventos/eventos.constants";
import { useSecciones } from "@/features/secciones/secciones.api";
import { descargar, mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { AnadirLineasDialogo } from "./AnadirLineasDialogo";
import { EnvioTarjeta } from "./EnvioTarjeta";
import { useCambiarEnlace, useCerrarPedido, useEnvios, usePedido, useQuitarLinea } from "./pedidos.api";
import type { DetallePedido, PersonaPedido } from "./pedidos.types";
import { describirLinea } from "./pedidos.utils";

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
const claseItem = "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hundido";

type Pestana = "revisar" | "personas" | "proveedor";

const estadoDelPedido = (p: DetallePedido["pedido"]) =>
  p.cerrado
    ? { texto: "Cerrado", clase: "bg-hundido text-suave" }
    : p.formularioAbierto
      ? { texto: "Recibiendo pedidos", clase: "bg-bosque-claro text-bosque" }
      : { texto: "Formulario fuera de fechas", clase: "bg-ambar-claro text-[color-mix(in_oklch,var(--color-ambar)_65%,var(--color-tinta))]" };

const FilaPersona = ({ persona: p, editable, seccion, onQuitar, onAnadir }: {
  persona: PersonaPedido;
  editable: boolean;
  seccion: string;
  onQuitar: (lineaId: string, descripcion: string) => void;
  onAnadir: () => void;
}) => (
  <li className="flex flex-col gap-2 py-3">
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{p.educando.nombre}</span> <span className="text-suave">{p.educando.apellidos}</span>
        <span className="text-sm text-suave"> · {seccion}</span>
      </span>
      <span className="text-right text-sm tabular-nums">
        <span className="block font-semibold">{euros(p.importeCentimos)}</span>
        {p.estado === "PARCIAL" && <span className="text-xs text-suave">{euros(p.pagadoCentimos)} pagado</span>}
      </span>
      <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", ESTADOS[p.estado].clase)}>{ESTADOS[p.estado].etiqueta}</span>
    </div>
    <ul className="flex flex-col gap-1 pl-1">
      {p.lineas.map((l) => (
        <li key={l.id} className="flex items-center justify-between gap-3 text-sm text-suave">
          <span>{describirLinea(l.articulo, l.elecciones)}</span>
          <span className="flex items-center gap-1">
            <span className="tabular-nums">{euros(l.importeCentimos)}</span>
            {editable && (
              <button
                type="button"
                onClick={() => onQuitar(l.id, describirLinea(l.articulo, l.elecciones))}
                aria-label={`Quitar ${describirLinea(l.articulo, l.elecciones)} de ${p.educando.nombre}`}
                className="grid size-7 place-items-center rounded-full hover:bg-rojo-claro hover:text-rojo"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
    {editable && (
      <button type="button" onClick={onAnadir} className="w-fit pl-1 text-sm font-semibold text-bosque">
        + Añadir algo más
      </button>
    )}
  </li>
);

// D-66 a D-68: un pedido con su enlace, lo pendiente de revisar, lo pedido por persona y el resumen del proveedor.
export const PedidoDetallePagina = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const aviso = (useLocation().state as { aviso?: string } | null)?.aviso;
  const { grupoActivo } = usePerfil();
  const gestiona = grupoActivo?.rol === "ADMIN" || grupoActivo?.rol === "TESORERIA";
  const esAdmin = grupoActivo?.rol === "ADMIN";
  const { data, isPending, error } = usePedido(id);
  const envios = useEnvios(id, gestiona);
  const { data: secciones = [] } = useSecciones();
  const cambiarEnlace = useCambiarEnlace();
  const cerrarPedido = useCerrarPedido();
  const quitarLinea = useQuitarLinea();
  const borrar = useBorrarEvento();

  const [pestana, setPestana] = useState<Pestana | null>(null);
  const [anadiendo, setAnadiendo] = useState<{ educandoId: string | null } | null>(null);
  const [quitando, setQuitando] = useState<{ lineaId: string; descripcion: string } | null>(null);
  const [cambiandoEnlace, setCambiandoEnlace] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  if (isPending) return <Cargando />;
  if (error || !data) return <Aviso tono="error">{mensajeDeError(error)}</Aviso>;

  const { pedido, resumen, personas, proveedor } = data;
  const pendientes = envios.data?.envios ?? [];
  const pestanas: { valor: Pestana; etiqueta: string }[] = [
    ...(gestiona ? [{ valor: "revisar" as const, etiqueta: `Por revisar${pendientes.length ? ` (${pendientes.length})` : ""}` }] : []),
    { valor: "personas", etiqueta: `Por persona (${resumen.personas})` },
    { valor: "proveedor", etiqueta: "Para el proveedor" },
  ];
  const activa = pestana ?? (gestiona && pendientes.length ? "revisar" : "personas");
  const estado = estadoDelPedido(pedido);
  const seccion = (sid: string) => secciones.find((s) => s.id === sid)?.nombre ?? "";

  const exportar = async (vista: "personas" | "proveedor") => {
    setErrorAccion(null);
    try {
      await descargar(`/pedidos/${pedido.id}/exportar?vista=${vista}`);
    } catch (e) {
      setErrorAccion(mensajeDeError(e));
    }
  };

  // Pestañas accesibles: flechas izquierda y derecha para moverse entre ellas.
  const teclas = (e: KeyboardEvent) => {
    const i = pestanas.findIndex((p) => p.valor === activa);
    const siguiente = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
    if (siguiente === null) return;
    const p = pestanas[(siguiente + pestanas.length) % pestanas.length];
    setPestana(p.valor);
    document.getElementById(`pestana-${p.valor}`)?.focus();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Link to="/eventos" className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> Eventos
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-balance">{pedido.nombre}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-suave">
              <span>
                Pedido · del {fechaLarga(pedido.fechaInicio)} al {fechaLarga(pedido.fechaFin)}
              </span>
              <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold", estado.clase)}>{estado.texto}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {gestiona && !pedido.cerrado && (
              <Boton variante="secundario" tamano="pequeno" onClick={() => setAnadiendo({ educandoId: null })}>
                <Plus className="size-4" aria-hidden /> Apuntar a mano
              </Boton>
            )}
            <Menu.Root>
              <Menu.Trigger asChild>
                <Boton variante="secundario" tamano="pequeno" aria-label="Más acciones">
                  <Ellipsis className="size-4" aria-hidden />
                </Boton>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-2xl bg-superficie p-1.5 shadow-xl ring-1 ring-linea">
                  <Menu.Item className={claseItem} onSelect={() => exportar("personas")}>
                    <FileSpreadsheet className="size-4" aria-hidden /> Excel por persona
                  </Menu.Item>
                  <Menu.Item className={claseItem} onSelect={() => exportar("proveedor")}>
                    <FileSpreadsheet className="size-4" aria-hidden /> Excel para el proveedor
                  </Menu.Item>
                  {gestiona && (
                    <>
                      <Menu.Separator className="my-1 h-px bg-linea" />
                      <Menu.Item className={claseItem} onSelect={() => navigate(`/eventos/pedidos/${pedido.id}/editar`)}>
                        <Pencil className="size-4" aria-hidden /> Editar artículos y fechas
                      </Menu.Item>
                      <Menu.Item className={claseItem} onSelect={() => setCerrando(true)}>
                        {pedido.cerrado ? <LockOpen className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                        {pedido.cerrado ? "Reabrir el pedido" : "Cerrar el pedido"}
                      </Menu.Item>
                    </>
                  )}
                  {esAdmin && (
                    <Menu.Item className={cx(claseItem, "text-rojo")} onSelect={() => setBorrando(true)}>
                      <Trash2 className="size-4" aria-hidden /> Borrar el pedido
                    </Menu.Item>
                  )}
                </Menu.Content>
              </Menu.Portal>
            </Menu.Root>
          </div>
        </div>
      </div>

      {aviso && <Aviso tono="exito">{aviso}</Aviso>}
      {errorAccion && <Aviso tono="error">{errorAccion}</Aviso>}

      {gestiona && pedido.enlace && !pedido.cerrado && (
        <section aria-labelledby="enlace-titulo" className="flex flex-col gap-3 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="enlace-titulo" className="font-display text-xl font-bold">
                Enlace para las familias
              </h2>
              <p className="text-sm text-suave">Pégalo en el grupo de familias. Lo que envíen llega a «Por revisar».</p>
            </div>
            <Boton variante="fantasma" tamano="pequeno" onClick={() => setCambiandoEnlace(true)}>
              <RefreshCw className="size-4" aria-hidden /> Cambiar enlace
            </Boton>
          </div>
          <EnlaceCompartible
            enlace={pedido.enlace}
            mensaje={`Pedido «${pedido.nombre}»:`}
            caducidad={
              pedido.formularioAbierto
                ? `Funciona hasta el ${fechaLarga(pedido.fechaFin)} o hasta que cierres el pedido.`
                : "Ahora mismo no admite pedidos: revisa las fechas."
            }
          />
        </section>
      )}

      <section aria-label="Resumen" className="flex flex-col gap-3 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { etiqueta: "Debido", valor: euros(resumen.debidoCentimos) },
            { etiqueta: "Cobrado", valor: euros(resumen.pagadoCentimos) },
            { etiqueta: "Personas", valor: String(resumen.personas) },
            { etiqueta: "Unidades", valor: String(resumen.unidades) },
          ].map((d) => (
            <div key={d.etiqueta}>
              <dt className="text-xs font-semibold text-suave">{d.etiqueta}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{d.valor}</dd>
            </div>
          ))}
        </dl>
        {resumen.debidoCentimos > 0 && <BarraProgreso valor={resumen.pagadoCentimos} total={resumen.debidoCentimos} etiqueta="Cobrado del pedido" />}
      </section>

      <div role="tablist" aria-label="Vistas del pedido" onKeyDown={teclas} className="-m-1 flex gap-2 overflow-x-auto p-1 sin-barra">
        {pestanas.map((p) => (
          <button
            key={p.valor}
            id={`pestana-${p.valor}`}
            type="button"
            role="tab"
            aria-selected={activa === p.valor}
            aria-controls={`panel-${p.valor}`}
            tabIndex={activa === p.valor ? 0 : -1}
            onClick={() => setPestana(p.valor)}
            className={cx(
              "h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
              activa === p.valor ? "bg-tinta text-fondo ring-tinta" : "bg-superficie text-suave ring-linea hover:text-tinta",
            )}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${activa}`} aria-labelledby={`pestana-${activa}`}>
        {activa === "revisar" &&
          (envios.isPending ? (
            <Cargando />
          ) : pendientes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-linea p-8 text-center">
              <Inbox className="size-6 text-suave" aria-hidden />
              <p className="font-semibold">Nada por revisar</p>
              <p className="max-w-sm text-sm text-suave">Cuando una familia envíe el formulario, aparecerá aquí para que lo aceptes.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {pedido.cerrado && <Aviso tono="info">El pedido está cerrado: reábrelo para aceptar envíos.</Aviso>}
              {pendientes.map((e) => (
                <EnvioTarjeta key={e.id} pedidoId={pedido.id} envio={e} cerrado={pedido.cerrado} />
              ))}
            </div>
          ))}

        {activa === "personas" &&
          (personas.length === 0 ? (
            <p className="rounded-3xl bg-superficie p-6 text-center text-suave ring-1 ring-linea">Aún no hay nada pedido.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-linea rounded-3xl bg-superficie px-5 ring-1 ring-linea">
              {personas.map((p) => (
                <FilaPersona
                  key={p.cargoId}
                  persona={p}
                  seccion={seccion(p.seccionId)}
                  editable={gestiona && !pedido.cerrado}
                  onQuitar={(lineaId, descripcion) => setQuitando({ lineaId, descripcion })}
                  onAnadir={() => setAnadiendo({ educandoId: p.educando.id })}
                />
              ))}
            </ul>
          ))}

        {activa === "proveedor" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl bg-superficie p-5 ring-1 ring-linea">
              <h2 className="mb-3 font-display text-lg font-bold">Unidades</h2>
              {proveedor.unidades.length === 0 ? (
                <p className="text-sm text-suave">Aún no hay nada pedido.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-suave">
                    <tr>
                      <th className="pb-2 font-semibold">Artículo</th>
                      <th className="pb-2 font-semibold">Opciones</th>
                      <th className="pb-2 text-right font-semibold">Uds.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-linea">
                    {proveedor.unidades.map((u) => (
                      <tr key={`${u.articulo}-${u.opciones}`}>
                        <td className="py-2 font-semibold">{u.articulo}</td>
                        <td className="py-2 text-suave">{u.opciones || "—"}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">{u.unidades}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section className="rounded-3xl bg-superficie p-5 ring-1 ring-linea">
              <h2 className="font-display text-lg font-bold">Textos a estampar</h2>
              <p className="mb-3 text-sm text-suave">Sin decir de quién son: así se pueden mandar tal cual.</p>
              {proveedor.textos.length === 0 ? (
                <p className="text-sm text-suave">Ninguno.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-linea text-sm">
                  {proveedor.textos.map((t, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span className="font-semibold">{t.texto}</span>
                      <span className="text-right text-suave">
                        {t.articulo}
                        {t.opciones && ` · ${t.opciones}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      {anadiendo && (
        <AnadirLineasDialogo
          key={anadiendo.educandoId ?? "nuevo"}
          pedidoId={pedido.id}
          articulos={pedido.articulos}
          abierto
          educandoInicial={anadiendo.educandoId}
          onCambiar={(v) => !v && setAnadiendo(null)}
        />
      )}
      <Confirmar
        abierto={quitando !== null}
        onCambiar={(v) => !v && setQuitando(null)}
        titulo="¿Quitar esta unidad?"
        descripcion={`${quitando?.descripcion ?? ""}. Su importe se descuenta de lo que debe.`}
        accion="Quitar"
        peligrosa
        onConfirmar={() => quitarLinea.mutateAsync({ id: pedido.id, lineaId: quitando!.lineaId })}
      />
      <Confirmar
        abierto={cambiandoEnlace}
        onCambiar={setCambiandoEnlace}
        titulo="¿Cambiar el enlace?"
        descripcion="El enlace actual dejará de funcionar y tendrás que compartir el nuevo. Úsalo si el enlace ha llegado a quien no debía."
        accion="Cambiar enlace"
        onConfirmar={() => cambiarEnlace.mutateAsync(pedido.id)}
      />
      <Confirmar
        abierto={cerrando}
        onCambiar={setCerrando}
        titulo={pedido.cerrado ? "¿Reabrir el pedido?" : "¿Cerrar el pedido?"}
        descripcion={
          pedido.cerrado
            ? "El enlace volverá a admitir pedidos (si está dentro de fechas) y podrás cambiar lo pedido."
            : "El enlace deja de admitir pedidos y no se podrá cambiar lo pedido. Ciérralo al mandarlo al proveedor; los pagos se siguen cuadrando igual."
        }
        accion={pedido.cerrado ? "Reabrir" : "Cerrar pedido"}
        onConfirmar={() => cerrarPedido.mutateAsync({ id: pedido.id, cerrar: !pedido.cerrado })}
      />
      <Confirmar
        abierto={borrando}
        onCambiar={setBorrando}
        titulo="¿Borrar el pedido?"
        descripcion="Se borran el pedido, su catálogo, lo pedido y lo pendiente de revisar. Si ya hay pagos, antes hay que deshacerlos en Movimientos."
        accion="Borrar"
        peligrosa
        onConfirmar={async () => {
          await borrar.mutateAsync(pedido.id);
          navigate("/eventos");
        }}
      />
    </div>
  );
};
