import { ArrowLeft, ChevronDown, ChevronUp, Plus, Shirt, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { CampoEuros } from "@/components/CampoEuros";
import { Cargando } from "@/components/Cargando";
import { ApiError, mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { aCentimos, aTextoEuros } from "@/utils/dinero";
import { useCrearPedido, useEditarPedido, usePedido } from "./pedidos.api";
import type { ArticuloEntrada, DetallePedido, TipoOpcion } from "./pedidos.types";
import { TEXTO_SEGURO } from "./pedidos.utils";

// El catalogo mientras se edita: importes y numeros como texto, y una clave estable para React.
type ValorForm = { clave: string; id?: string; valor: string; suplemento: string };
type OpcionForm = {
  clave: string;
  id?: string;
  nombre: string;
  tipo: TipoOpcion;
  obligatoria: boolean;
  maxLongitud: string;
  suplemento: string;
  valores: ValorForm[];
};
type ArticuloForm = { clave: string; id?: string; nombre: string; precio: string; maxUnidades: string; opciones: OpcionForm[] };

let contador = 0;
const clave = () => `n${++contador}`;

const valorNuevo = (valor = ""): ValorForm => ({ clave: clave(), valor, suplemento: "" });
const opcionNueva = (tipo: TipoOpcion, nombre = ""): OpcionForm => ({
  clave: clave(),
  nombre,
  tipo,
  obligatoria: tipo === "LISTA",
  maxLongitud: tipo === "TEXTO" ? "12" : "",
  suplemento: "",
  valores: [],
});
const articuloNuevo = (): ArticuloForm => ({ clave: clave(), nombre: "", precio: "", maxUnidades: "5", opciones: [] });

// Plantilla para el caso de siempre: ropa con talla y, si se quiere, nombre al dorso.
const ropaConTalla = (): ArticuloForm => ({
  ...articuloNuevo(),
  opciones: [
    { ...opcionNueva("LISTA", "Talla"), valores: ["4", "6", "8", "10", "12", "14", "S", "M", "L", "XL"].map(valorNuevo) },
    { ...opcionNueva("TEXTO", "Nombre al dorso"), obligatoria: false },
  ],
});

const desdeDetalle = (d: DetallePedido): ArticuloForm[] =>
  d.pedido.articulos.map((a) => ({
    clave: clave(),
    id: a.id,
    nombre: a.nombre,
    precio: aTextoEuros(a.precioCentimos),
    maxUnidades: String(a.maxUnidades),
    opciones: a.opciones.map((o) => ({
      clave: clave(),
      id: o.id,
      nombre: o.nombre,
      tipo: o.tipo,
      obligatoria: o.obligatoria,
      maxLongitud: o.maxLongitud ? String(o.maxLongitud) : "",
      suplemento: o.suplementoCentimos ? aTextoEuros(o.suplementoCentimos) : "",
      valores: o.valores.map((v) => ({ clave: clave(), id: v.id, valor: v.valor, suplemento: v.suplementoCentimos ? aTextoEuros(v.suplementoCentimos) : "" })),
    })),
  }));

const suplementoValido = (texto: string) => !texto.trim() || aCentimos(texto) !== null;
const etiquetaValida = (texto: string) => TEXTO_SEGURO.test(texto.trim());

// Errores por clave del elemento: "nombre", "<clave>.precio"...
const validar = (datos: { nombre: string; fechaInicio: string; fechaFin: string }, articulos: ArticuloForm[]) => {
  const e: Record<string, string> = {};
  if (datos.nombre.trim().length < 2) e.nombre = "El nombre es demasiado corto";
  if (!datos.fechaInicio) e.fechaInicio = "Elige una fecha";
  if (!datos.fechaFin) e.fechaFin = "Elige una fecha";
  if (datos.fechaInicio && datos.fechaFin && datos.fechaFin < datos.fechaInicio) e.fechaFin = "No puede ser anterior al inicio";
  if (!articulos.length) e.articulos = "Añade al menos un artículo";
  for (const a of articulos) {
    if (a.nombre.trim().length < 2 || !etiquetaValida(a.nombre)) e[`${a.clave}.nombre`] = "Escribe un nombre (solo letras, números y espacios)";
    if (aCentimos(a.precio) === null) e[`${a.clave}.precio`] = "Escribe un precio";
    const max = Number(a.maxUnidades);
    if (!Number.isInteger(max) || max < 1 || max > 20) e[`${a.clave}.maxUnidades`] = "Entre 1 y 20";
    for (const o of a.opciones) {
      if (!o.nombre.trim() || !etiquetaValida(o.nombre)) e[`${o.clave}.nombre`] = "Escribe un nombre";
      if (o.tipo === "LISTA") {
        if (!o.valores.length) e[`${o.clave}.valores`] = "Añade al menos un valor";
        const vistos = new Set<string>();
        for (const v of o.valores) {
          const normal = v.valor.trim().toLocaleLowerCase("es");
          if (!normal || !etiquetaValida(v.valor)) e[`${v.clave}.valor`] = "Valor no válido";
          else if (vistos.has(normal)) e[`${v.clave}.valor`] = "Repetido";
          vistos.add(normal);
          if (!suplementoValido(v.suplemento)) e[`${v.clave}.suplemento`] = "Importe no válido";
        }
      } else {
        const largo = Number(o.maxLongitud);
        if (!Number.isInteger(largo) || largo < 1 || largo > 40) e[`${o.clave}.maxLongitud`] = "Entre 1 y 40";
        if (!suplementoValido(o.suplemento)) e[`${o.clave}.suplemento`] = "Importe no válido";
      }
    }
  }
  return e;
};

const aEntrada = (articulos: ArticuloForm[]): ArticuloEntrada[] =>
  articulos.map((a) => ({
    ...(a.id && { id: a.id }),
    nombre: a.nombre.trim(),
    precioCentimos: aCentimos(a.precio)!,
    maxUnidades: Number(a.maxUnidades),
    opciones: a.opciones.map((o) => ({
      ...(o.id && { id: o.id }),
      nombre: o.nombre.trim(),
      tipo: o.tipo,
      obligatoria: o.obligatoria,
      maxLongitud: o.tipo === "TEXTO" ? Number(o.maxLongitud) : null,
      suplementoCentimos: o.tipo === "TEXTO" ? (aCentimos(o.suplemento) ?? 0) : 0,
      valores:
        o.tipo === "LISTA"
          ? o.valores.map((v) => ({ ...(v.id && { id: v.id }), valor: v.valor.trim(), suplementoCentimos: aCentimos(v.suplemento) ?? 0 }))
          : [],
    })),
  }));

const ErrorCampo = ({ texto }: { texto?: string }) => (texto ? <p className="text-sm font-medium text-rojo">{texto}</p> : null);

const claseEntrada = (error?: string) =>
  cx(
    "h-11 w-full rounded-xl bg-superficie px-3.5 text-base ring-1 focus:outline-none focus:ring-2",
    error ? "ring-rojo focus:ring-rojo" : "ring-linea focus:ring-bosque",
  );

// D-66: crear o editar un pedido con su catalogo de articulos y opciones.
export const PedidoFormularioPagina = () => {
  const { id } = useParams();
  const edicion = Boolean(id);
  const navigate = useNavigate();
  const { data: detalle, isPending: cargando } = usePedido(id ?? "");
  const crear = useCrearPedido();
  const editar = useEditarPedido();

  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState("");
  const [instrucciones, setInstrucciones] = useState("");
  const [articulos, setArticulos] = useState<ArticuloForm[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [pegando, setPegando] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!detalle) return;
    setNombre(detalle.pedido.nombre);
    setFechaInicio(detalle.pedido.fechaInicio);
    setFechaFin(detalle.pedido.fechaFin);
    setInstrucciones(detalle.pedido.instruccionesPago ?? "");
    setArticulos(desdeDetalle(detalle));
  }, [detalle]);

  if (edicion && cargando) return <Cargando />;
  if (edicion && !detalle) return <Aviso tono="error">No se ha encontrado el pedido.</Aviso>;

  const cambiarArticulo = (c: string, cambio: Partial<ArticuloForm>) => setArticulos((as) => as.map((a) => (a.clave === c ? { ...a, ...cambio } : a)));
  const cambiarOpcion = (a: ArticuloForm, c: string, cambio: Partial<OpcionForm>) =>
    cambiarArticulo(a.clave, { opciones: a.opciones.map((o) => (o.clave === c ? { ...o, ...cambio } : o)) });
  const mover = (i: number, paso: number) =>
    setArticulos((as) => {
      const copia = [...as];
      [copia[i], copia[i + paso]] = [copia[i + paso], copia[i]];
      return copia;
    });

  // "4, 6, 8" o una por linea: varios valores de golpe.
  const pegarValores = (a: ArticuloForm, o: OpcionForm) => {
    const nuevos = (pegando[o.clave] ?? "")
      .split(/[,\n;]+/)
      .map((v) => v.trim())
      .filter((v) => v && !o.valores.some((x) => x.valor.trim().toLocaleLowerCase("es") === v.toLocaleLowerCase("es")));
    if (!nuevos.length) return;
    cambiarOpcion(a, o.clave, { valores: [...o.valores, ...nuevos.map(valorNuevo)] });
    setPegando((p) => ({ ...p, [o.clave]: "" }));
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    setErrorServidor(null);
    const encontrados = validar({ nombre, fechaInicio, fechaFin }, articulos);
    setErrores(encontrados);
    if (Object.keys(encontrados).length) return;
    const datos = { nombre: nombre.trim(), fechaInicio, fechaFin, instruccionesPago: instrucciones.trim() || null, articulos: aEntrada(articulos) };
    setGuardando(true);
    try {
      if (edicion) {
        await editar.mutateAsync({ id: id!, ...datos });
        navigate(`/eventos/pedidos/${id}`, { state: { aviso: "Cambios guardados. Lo ya pedido conserva sus precios." } });
      } else {
        const res = await crear.mutateAsync(datos);
        navigate(`/eventos/pedidos/${res.pedido.id}`);
      }
    } catch (err) {
      const campos = err instanceof ApiError ? err.campos : undefined;
      setErrorServidor(campos ? Object.values(campos)[0] : mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link to={edicion ? `/eventos/pedidos/${id}` : "/eventos"} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> {edicion ? detalle!.pedido.nombre : "Eventos"}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">{edicion ? "Editar pedido" : "Nuevo pedido"}</h1>
        {!edicion && (
          <p className="text-suave">
            Para encargos bajo demanda: sudaderas, camisetas, pañoletas… Las familias lo piden con un enlace y tú revisas cada pedido antes
            de que cuente.
          </p>
        )}
      </div>

      <form onSubmit={guardar} noValidate className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
          <h2 className="font-display text-xl font-bold">Datos</h2>
          <Campo etiqueta="Nombre" placeholder="Sudaderas y camisetas 2026" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} autoFocus={!edicion} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Se puede pedir desde" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} error={errores.fechaInicio} />
            <Campo
              etiqueta="Hasta"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              error={errores.fechaFin}
              ayuda="Después de esta fecha el enlace deja de admitir pedidos."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="instrucciones" className="text-sm font-semibold">
              Cómo se paga (opcional)
            </label>
            <textarea
              id="instrucciones"
              rows={3}
              maxLength={500}
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              placeholder="Transferencia a ES00 0000… o Bizum al 600 000 000, indicando el nombre del niño."
              className="w-full rounded-2xl bg-superficie px-4 py-3 text-base ring-1 ring-linea placeholder:text-suave focus:outline-none focus:ring-2 focus:ring-bosque"
            />
            <p className="text-sm text-suave">Las familias lo ven al terminar el pedido, junto con lo que tienen que pagar.</p>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Artículos</h2>
              <p className="text-sm text-suave">Cada artículo con su precio y lo que hay que elegir. Los suplementos se suman al precio.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" tamano="pequeno" onClick={() => setArticulos((as) => [...as, ropaConTalla()])}>
                <Shirt className="size-4" aria-hidden /> Ropa con talla
              </Boton>
              <Boton variante="secundario" tamano="pequeno" onClick={() => setArticulos((as) => [...as, articuloNuevo()])}>
                <Plus className="size-4" aria-hidden /> Artículo
              </Boton>
            </div>
          </div>
          <ErrorCampo texto={errores.articulos} />

          {articulos.map((a, i) => (
            <article key={a.clave} aria-label={a.nombre || `Artículo ${i + 1}`} className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
              <div className="flex items-start gap-3">
                <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_9rem_8rem]">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${a.clave}-nombre`} className="text-sm font-semibold">
                      Artículo
                    </label>
                    <input
                      id={`${a.clave}-nombre`}
                      value={a.nombre}
                      placeholder="Sudadera"
                      onChange={(e) => cambiarArticulo(a.clave, { nombre: e.target.value })}
                      className={claseEntrada(errores[`${a.clave}.nombre`])}
                    />
                    <ErrorCampo texto={errores[`${a.clave}.nombre`]} />
                  </div>
                  <CampoEuros etiqueta="Precio" value={a.precio} onChange={(e) => cambiarArticulo(a.clave, { precio: e.target.value })} error={errores[`${a.clave}.precio`]} />
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`${a.clave}-max`} className="text-sm font-semibold">
                      Máx. por persona
                    </label>
                    <input
                      id={`${a.clave}-max`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={20}
                      value={a.maxUnidades}
                      onChange={(e) => cambiarArticulo(a.clave, { maxUnidades: e.target.value })}
                      className={claseEntrada(errores[`${a.clave}.maxUnidades`])}
                    />
                    <ErrorCampo texto={errores[`${a.clave}.maxUnidades`]} />
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir" className="grid size-8 place-items-center rounded-full text-suave hover:bg-hundido disabled:opacity-30">
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={i === articulos.length - 1}
                    onClick={() => mover(i, 1)}
                    aria-label="Bajar"
                    className="grid size-8 place-items-center rounded-full text-suave hover:bg-hundido disabled:opacity-30"
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setArticulos((as) => as.filter((x) => x.clave !== a.clave))}
                    aria-label={`Quitar ${a.nombre || "artículo"}`}
                    className="grid size-8 place-items-center rounded-full text-suave hover:bg-rojo-claro hover:text-rojo"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {a.opciones.map((o) => (
                  <div key={o.clave} className="flex flex-col gap-3 rounded-2xl bg-hundido p-3.5">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                        <label htmlFor={`${o.clave}-nombre`} className="text-sm font-semibold">
                          {o.tipo === "LISTA" ? "Elegir de una lista" : "Texto corto"}
                        </label>
                        <input
                          id={`${o.clave}-nombre`}
                          value={o.nombre}
                          placeholder={o.tipo === "LISTA" ? "Talla, color…" : "Nombre al dorso"}
                          onChange={(e) => cambiarOpcion(a, o.clave, { nombre: e.target.value })}
                          className={claseEntrada(errores[`${o.clave}.nombre`])}
                        />
                        <ErrorCampo texto={errores[`${o.clave}.nombre`]} />
                      </div>
                      {o.tipo === "TEXTO" && (
                        <>
                          <div className="flex w-28 flex-col gap-1.5">
                            <label htmlFor={`${o.clave}-largo`} className="text-sm font-semibold">
                              Máx. letras
                            </label>
                            <input
                              id={`${o.clave}-largo`}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={40}
                              value={o.maxLongitud}
                              onChange={(e) => cambiarOpcion(a, o.clave, { maxLongitud: e.target.value })}
                              className={claseEntrada(errores[`${o.clave}.maxLongitud`])}
                            />
                            <ErrorCampo texto={errores[`${o.clave}.maxLongitud`]} />
                          </div>
                          <CampoEuros
                            etiqueta="Suplemento"
                            className="w-32"
                            placeholder="0"
                            value={o.suplemento}
                            onChange={(e) => cambiarOpcion(a, o.clave, { suplemento: e.target.value })}
                            error={errores[`${o.clave}.suplemento`]}
                          />
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => cambiarArticulo(a.clave, { opciones: a.opciones.filter((x) => x.clave !== o.clave) })}
                        aria-label={`Quitar ${o.nombre || "opción"}`}
                        className="mt-7 grid size-9 place-items-center rounded-full text-suave hover:bg-rojo-claro hover:text-rojo"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={o.obligatoria}
                        onChange={(e) => cambiarOpcion(a, o.clave, { obligatoria: e.target.checked })}
                        className="size-5 accent-[var(--color-bosque)]"
                      />
                      Hay que rellenarlo siempre
                    </label>

                    {o.tipo === "LISTA" && (
                      <div className="flex flex-col gap-2">
                        <ul className="flex flex-col gap-2">
                          {o.valores.map((v) => (
                            <li key={v.clave} className="flex items-start gap-2">
                              <div className="flex flex-1 flex-col gap-1">
                                <input
                                  aria-label="Valor"
                                  value={v.valor}
                                  onChange={(e) =>
                                    cambiarOpcion(a, o.clave, { valores: o.valores.map((x) => (x.clave === v.clave ? { ...x, valor: e.target.value } : x)) })
                                  }
                                  className={claseEntrada(errores[`${v.clave}.valor`])}
                                />
                                <ErrorCampo texto={errores[`${v.clave}.valor`]} />
                              </div>
                              <CampoEuros
                                etiqueta={`Suplemento de ${v.valor || "este valor"}`}
                                etiquetaVisible={false}
                                className="w-28"
                                placeholder="+0"
                                value={v.suplemento}
                                onChange={(e) =>
                                  cambiarOpcion(a, o.clave, { valores: o.valores.map((x) => (x.clave === v.clave ? { ...x, suplemento: e.target.value } : x)) })
                                }
                                error={errores[`${v.clave}.suplemento`]}
                              />
                              <button
                                type="button"
                                onClick={() => cambiarOpcion(a, o.clave, { valores: o.valores.filter((x) => x.clave !== v.clave) })}
                                aria-label={`Quitar ${v.valor || "valor"}`}
                                className="mt-1 grid size-9 shrink-0 place-items-center rounded-full text-suave hover:bg-rojo-claro hover:text-rojo"
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2">
                          <input
                            aria-label={`Añadir valores a ${o.nombre || "la lista"}`}
                            placeholder="Añadir valores: 9/10, 11/12, S, M…"
                            value={pegando[o.clave] ?? ""}
                            onChange={(e) => setPegando((p) => ({ ...p, [o.clave]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                pegarValores(a, o);
                              }
                            }}
                            className={claseEntrada(errores[`${o.clave}.valores`])}
                          />
                          <Boton variante="secundario" tamano="pequeno" className="mt-1" onClick={() => pegarValores(a, o)}>
                            Añadir
                          </Boton>
                        </div>
                        <ErrorCampo texto={errores[`${o.clave}.valores`]} />
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Boton variante="fantasma" tamano="pequeno" onClick={() => cambiarArticulo(a.clave, { opciones: [...a.opciones, opcionNueva("LISTA")] })} disabled={a.opciones.length >= 5}>
                    <Plus className="size-4" aria-hidden /> Lista (talla, color…)
                  </Boton>
                  <Boton variante="fantasma" tamano="pequeno" onClick={() => cambiarArticulo(a.clave, { opciones: [...a.opciones, opcionNueva("TEXTO")] })} disabled={a.opciones.length >= 5}>
                    <Plus className="size-4" aria-hidden /> Texto (nombre al dorso…)
                  </Boton>
                </div>
              </div>
            </article>
          ))}

          {articulos.length === 0 && (
            <p className="rounded-3xl border border-dashed border-linea p-6 text-center text-suave">
              Empieza con «Ropa con talla» para una camiseta o sudadera, o crea un artículo vacío.
            </p>
          )}
        </section>

        {Object.keys(errores).length > 0 && <Aviso tono="error">Revisa los campos marcados.</Aviso>}
        {errorServidor && <Aviso tono="error">{errorServidor}</Aviso>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            to={edicion ? `/eventos/pedidos/${id}` : "/eventos"}
            className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold ring-1 ring-linea hover:bg-hundido"
          >
            Cancelar
          </Link>
          <Boton type="submit" cargando={guardando}>
            {edicion ? "Guardar cambios" : "Crear pedido"}
          </Boton>
        </div>
      </form>
    </div>
  );
};
