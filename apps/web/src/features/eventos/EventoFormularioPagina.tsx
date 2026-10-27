import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "zod";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { CampoEuros } from "@/components/CampoEuros";
import { Cargando } from "@/components/Cargando";
import { useEducandos } from "@/features/educandos/educandos.api";
import { useSecciones } from "@/features/secciones/secciones.api";
import { FONDO_SECCION } from "@/features/secciones/secciones.constants";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { aCentimos, aTextoEuros } from "@/utils/dinero";
import { mostrarErroresDelServidor } from "@/utils/formularios";
import { useCrearEvento, useEditarEvento, useEvento } from "./eventos.api";
import { TIPOS_EVENTO } from "./eventos.constants";
import type { DetalleEvento } from "./eventos.types";

const IMPORTE_NO_VALIDO = "Escribe un importe, por ejemplo 85 o 85,50";

const esquema = z
  .object({
    nombre: z.string().trim().min(2, "El nombre es demasiado corto").max(80, "El nombre es demasiado largo"),
    tipo: z.enum(["TODA_SECCION", "CON_APUNTADOS"]),
    fechaInicio: z.string().min(1, "Elige una fecha"),
    fechaFin: z.string().min(1, "Elige una fecha"),
    secciones: z.record(z.object({ activa: z.boolean(), importe: z.string() })),
    descuentoHermanos: z.boolean(),
    segundo: z.string(),
    tercero: z.string(),
    apuntados: z.array(z.string()),
  })
  .superRefine((d, ctx) => {
    const activas = Object.entries(d.secciones).filter(([, s]) => s.activa);
    if (!activas.length) ctx.addIssue({ code: "custom", path: ["secciones"], message: "Elige al menos una sección" });
    for (const [id, s] of activas) {
      if (aCentimos(s.importe) === null) ctx.addIssue({ code: "custom", path: ["secciones", id, "importe"], message: IMPORTE_NO_VALIDO });
    }
    if (d.fechaInicio && d.fechaFin && d.fechaFin < d.fechaInicio) {
      ctx.addIssue({ code: "custom", path: ["fechaFin"], message: "La fecha de fin no puede ser anterior al inicio" });
    }
    if (d.descuentoHermanos && aCentimos(d.segundo) === null) {
      ctx.addIssue({ code: "custom", path: ["segundo"], message: "Indica el precio del 2º hermano" });
    }
    if (d.descuentoHermanos && d.tercero.trim() && aCentimos(d.tercero) === null) {
      ctx.addIssue({ code: "custom", path: ["tercero"], message: IMPORTE_NO_VALIDO });
    }
  });
type Datos = z.infer<typeof esquema>;

const valoresIniciales = (seccionIds: string[], detalle?: DetalleEvento): Datos => {
  const e = detalle?.evento;
  return {
    nombre: e?.nombre ?? "",
    tipo: e?.tipo ?? "TODA_SECCION",
    fechaInicio: e?.fechaInicio ?? new Date().toISOString().slice(0, 10),
    fechaFin: e?.fechaFin ?? "",
    secciones: Object.fromEntries(
      seccionIds.map((id) => {
        const precio = e?.precios.find((p) => p.seccionId === id);
        return [id, { activa: Boolean(precio), importe: aTextoEuros(precio?.importeCentimos) }];
      }),
    ),
    descuentoHermanos: e?.descuentoHermanos ?? false,
    segundo: aTextoEuros(e?.precioSegundoCentimos),
    tercero: aTextoEuros(e?.precioTerceroCentimos),
    apuntados: [],
  };
};

// Crear (sin id) o editar (con id) un evento, en una sola pantalla con apartados (D-39).
export const EventoFormularioPagina = () => {
  const { id } = useParams();
  const edicion = Boolean(id);
  const navigate = useNavigate();
  const { data: secciones = [], isPending: cargandoSecciones } = useSecciones();
  const { data: detalle, isPending: cargandoEvento } = useEvento(id ?? "");
  const { data: lista } = useEducandos();
  const crear = useCrearEvento();
  const editar = useEditarEvento();
  const [mismoPrecio, setMismoPrecio] = useState("");

  const activas = useMemo(() => secciones.filter((s) => !s.archivada), [secciones]);
  const { register, control, handleSubmit, reset, watch, setValue, getValues, setError, formState: { errors, isSubmitting } } =
    useForm<Datos>({ resolver: zodResolver(esquema) });

  useEffect(() => {
    if (activas.length && (!edicion || detalle)) reset(valoresIniciales(activas.map((s) => s.id), detalle));
  }, [activas, detalle, edicion, reset]);

  const tipo = watch("tipo");
  const descuento = watch("descuentoHermanos");
  const seccionesForm = watch("secciones") ?? {};
  const seccionesElegidas = Object.entries(seccionesForm).filter(([, s]) => s.activa).map(([sid]) => sid);
  const candidatos = (lista?.educandos ?? []).filter((e) => seccionesElegidas.includes(e.seccionId));

  if (cargandoSecciones || (edicion && cargandoEvento)) return <Cargando />;
  if (edicion && !detalle) return <Aviso tono="error">No se ha encontrado el evento.</Aviso>;

  const aplicarMismoPrecio = () => {
    for (const s of activas) {
      setValue(`secciones.${s.id}`, { activa: getValues(`secciones.${s.id}.activa`), importe: mismoPrecio }, { shouldValidate: false });
    }
  };

  const guardar = handleSubmit(async (d) => {
    const datos = {
      nombre: d.nombre,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin,
      precios: Object.entries(d.secciones)
        .filter(([, s]) => s.activa)
        .map(([seccionId, s]) => ({ seccionId, importeCentimos: aCentimos(s.importe)! })),
      descuentoHermanos: d.descuentoHermanos,
      precioSegundoCentimos: d.descuentoHermanos ? aCentimos(d.segundo) : null,
      precioTerceroCentimos: d.descuentoHermanos && d.tercero.trim() ? aCentimos(d.tercero) : null,
    };
    try {
      if (edicion) {
        const res = await editar.mutateAsync({ id: id!, ...datos });
        const aviso =
          res.recalculados || res.sinCambiar
            ? `Se han recalculado ${res.recalculados} cargos.${res.sinCambiar ? ` ${res.sinCambiar} con importe ajustado a mano o con pagos no se han tocado.` : ""}`
            : "Cambios guardados.";
        navigate(`/eventos/${id}`, { state: { aviso } });
      } else {
        const res = await crear.mutateAsync({ ...datos, tipo: d.tipo, apuntados: d.tipo === "CON_APUNTADOS" ? d.apuntados : [] });
        navigate(`/eventos/${res.evento.id}`);
      }
    } catch (error) {
      mostrarErroresDelServidor(error, setError, ["nombre", "fechaInicio", "fechaFin"]);
    }
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link to={edicion ? `/eventos/${id}` : "/eventos"} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden /> {edicion ? detalle!.evento.nombre : "Eventos"}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">{edicion ? "Editar evento" : "Nuevo evento"}</h1>
      </div>

      <form onSubmit={guardar} noValidate className="flex flex-col gap-6">
        {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}

        <section className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
          <h2 className="font-display text-xl font-bold">Datos</h2>
          <Campo etiqueta="Nombre" placeholder="Cuota 2026-27" autoFocus={!edicion} error={errors.nombre?.message} {...register("nombre")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Desde" type="date" error={errors.fechaInicio?.message} {...register("fechaInicio")} />
            <Campo
              etiqueta="Hasta"
              type="date"
              ayuda="Mientras no pase esta fecha, los niños que entren en sus secciones también deberán pagarlo."
              error={errors.fechaFin?.message}
              {...register("fechaFin")}
            />
          </div>
          {!edicion && (
            <Controller
              control={control}
              name="tipo"
              render={({ field }) => (
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Tipo</legend>
                  <div role="radiogroup" aria-label="Tipo" className="grid gap-2 sm:grid-cols-2">
                    {TIPOS_EVENTO.map((t) => {
                      const elegido = field.value === t.valor;
                      return (
                        <button
                          key={t.valor}
                          type="button"
                          role="radio"
                          aria-checked={elegido}
                          onClick={() => field.onChange(t.valor)}
                          className={cx(
                            "flex flex-col gap-1 rounded-2xl p-3 text-left ring-1 transition",
                            elegido ? "bg-bosque-claro ring-bosque" : "bg-hundido ring-transparent hover:ring-linea",
                          )}
                        >
                          <span className="text-sm font-semibold">{t.etiqueta}</span>
                          <span className="text-sm text-suave">{t.descripcion}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            />
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
          <div>
            <h2 className="font-display text-xl font-bold">Secciones y precio</h2>
            <p className="text-sm text-suave">Marca las secciones que pagan este evento y cuánto paga cada niño.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-hundido p-3">
            <CampoEuros etiqueta="Mismo precio para todas" className="w-40" value={mismoPrecio} onChange={(e) => setMismoPrecio(e.target.value)} />
            <Boton variante="secundario" tamano="pequeno" className="mb-1.5" onClick={aplicarMismoPrecio} disabled={!mismoPrecio}>
              Aplicar
            </Boton>
          </div>
          <ul className="flex flex-col divide-y divide-linea">
            {activas.map((s) => {
              const activa = seccionesForm[s.id]?.activa ?? false;
              const error = (errors.secciones as Record<string, { importe?: { message?: string } }> | undefined)?.[s.id]?.importe?.message;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <label className="flex min-w-36 flex-1 cursor-pointer items-center gap-3">
                    <input type="checkbox" className="size-5 accent-[var(--color-bosque)]" {...register(`secciones.${s.id}.activa`)} />
                    <span className={cx("size-2.5 rounded-full", FONDO_SECCION[s.color])} aria-hidden />
                    <span className="font-semibold">{s.nombre}</span>
                  </label>
                  <CampoEuros
                    etiqueta={`Precio para ${s.nombre}`}
                    etiquetaVisible={false}
                    className="w-36"
                    disabled={!activa}
                    error={activa ? error : undefined}
                    {...register(`secciones.${s.id}.importe`)}
                  />
                </li>
              );
            })}
          </ul>
          {(errors.secciones as { message?: string } | undefined)?.message && (
            <p className="text-sm font-medium text-rojo">{(errors.secciones as { message?: string }).message}</p>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--color-bosque)]" {...register("descuentoHermanos")} />
            <span>
              <span className="block font-display text-xl font-bold">Precio de hermanos</span>
              <span className="text-sm text-suave">
                El mayor paga el precio de su sección; los demás, estos precios (nunca más que el de su sección). Solo cuentan
                los hermanos que pagan este evento.
              </span>
            </span>
          </label>
          {descuento && (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoEuros etiqueta="2º hermano" error={errors.segundo?.message} {...register("segundo")} />
              <CampoEuros etiqueta="3º y siguientes (opcional)" placeholder="Como el 2º" error={errors.tercero?.message} {...register("tercero")} />
            </div>
          )}
        </section>

        {!edicion && tipo === "CON_APUNTADOS" && (
          <section className="flex flex-col gap-3 rounded-3xl bg-superficie p-5 ring-1 ring-linea">
            <div>
              <h2 className="font-display text-xl font-bold">Quién va</h2>
              <p className="text-sm text-suave">Podrás añadir a más niños después, desde el evento.</p>
            </div>
            {seccionesElegidas.length === 0 ? (
              <p className="text-sm text-suave">Elige primero las secciones del evento.</p>
            ) : (
              <Controller
                control={control}
                name="apuntados"
                render={({ field }) => (
                  <div className="flex flex-col gap-4">
                    {activas
                      .filter((s) => seccionesElegidas.includes(s.id))
                      .map((s) => {
                        const ninos = candidatos.filter((e) => e.seccionId === s.id);
                        const todos = ninos.length > 0 && ninos.every((n) => field.value.includes(n.id));
                        const alternarTodos = () =>
                          field.onChange(
                            todos
                              ? field.value.filter((idN) => !ninos.some((n) => n.id === idN))
                              : [...new Set([...field.value, ...ninos.map((n) => n.id)])],
                          );
                        return (
                          <fieldset key={s.id} className="flex flex-col gap-1.5">
                            <legend className="flex w-full items-center justify-between gap-3">
                              <span className="text-xs font-bold tracking-[.12em] text-suave uppercase">{s.nombre}</span>
                              {ninos.length > 0 && (
                                <button type="button" onClick={alternarTodos} className="text-sm font-semibold text-bosque">
                                  {todos ? "Quitar a todos" : "Marcar a todos"}
                                </button>
                              )}
                            </legend>
                            {ninos.length === 0 && <p className="text-sm text-suave">No hay niños en esta sección.</p>}
                            <div className="grid gap-1 sm:grid-cols-2">
                              {ninos.map((n) => {
                                const marcado = field.value.includes(n.id);
                                return (
                                  <label key={n.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-hundido">
                                    <input
                                      type="checkbox"
                                      checked={marcado}
                                      onChange={() => field.onChange(marcado ? field.value.filter((x) => x !== n.id) : [...field.value, n.id])}
                                      className="size-5 accent-[var(--color-bosque)]"
                                    />
                                    <span className="truncate text-sm">
                                      {n.nombre} <span className="text-suave">{n.apellidos}</span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        );
                      })}
                    <p className="text-sm text-suave">
                      <Check className="mr-1 inline size-4 text-bosque" aria-hidden />
                      {field.value.length} apuntados
                    </p>
                  </div>
                )}
              />
            )}
          </section>
        )}

        {(crear.error || editar.error) && !errors.root && <Aviso tono="error">{mensajeDeError(crear.error ?? editar.error)}</Aviso>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            to={edicion ? `/eventos/${id}` : "/eventos"}
            className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold ring-1 ring-linea hover:bg-hundido"
          >
            Cancelar
          </Link>
          <Boton type="submit" cargando={isSubmitting}>{edicion ? "Guardar cambios" : "Crear evento"}</Boton>
        </div>
      </form>
    </div>
  );
};
