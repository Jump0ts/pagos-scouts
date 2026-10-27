import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Campo } from "@/components/Campo";
import { Dialogo } from "@/components/Dialogo";
import { SelectorSeccion } from "@/features/secciones/SelectorSeccion";
import { cx } from "@/utils/cx";
import { mostrarErroresDelServidor } from "@/utils/formularios";
import { useCrearEducando, useEditarEducando, useEducandos } from "./educandos.api";
import type { HijoEnFicha } from "./educandos.types";
import { ResponsablesCampos } from "./ResponsablesCampos";

const esquema = z
  .object({
    nombre: z.string().trim().min(1, "Escribe el nombre").max(60, "El nombre es demasiado largo"),
    apellidos: z.string().trim().max(80, "Los apellidos son demasiado largos"),
    fechaNacimiento: z
      .string()
      .refine((f) => !f || new Date(f) <= new Date(), "La fecha no puede ser futura"),
    seccionId: z.string({ required_error: "Elige una sección" }).min(1, "Elige una sección"),
    modoFamilia: z.enum(["nueva", "hermano", "fija"]),
    responsables: z.array(z.string()),
    hermanoFamiliaId: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.modoFamilia === "hermano" && !d.hermanoFamiliaId) {
      ctx.addIssue({ code: "custom", path: ["hermanoFamiliaId"], message: "Elige a su hermano o hermana" });
    }
    if (d.modoFamilia === "nueva") {
      d.responsables.forEach((r, i) => {
        if (r.trim() && r.trim().length < 2) ctx.addIssue({ code: "custom", path: ["responsables", i], message: "El nombre es demasiado corto" });
      });
    }
  });
type Datos = z.infer<typeof esquema>;

type Props = {
  abierto: boolean;
  onCambiar: (abierto: boolean) => void;
  // Editar a este niño (con su familia ya fijada).
  educando?: HijoEnFicha;
  // Dar de alta a un hermano: la familia ya esta decidida.
  familiaId?: string;
  alGuardar?: (familiaId: string) => void;
};

const plano = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const EducandoDialogo = ({ abierto, onCambiar, educando, familiaId, alGuardar }: Props) => {
  const crear = useCrearEducando();
  const editar = useEditarEducando();
  const { data: lista } = useEducandos();
  const [busquedaHermano, setBusquedaHermano] = useState("");
  const {
    register, control, handleSubmit, reset, watch, setError, formState: { errors, isSubmitting },
  } = useForm<Datos>({ resolver: zodResolver(esquema) });

  useEffect(() => {
    if (!abierto) return;
    setBusquedaHermano("");
    reset({
      nombre: educando?.nombre ?? "",
      apellidos: educando?.apellidos ?? "",
      fechaNacimiento: educando?.fechaNacimiento?.slice(0, 10) ?? "",
      seccionId: educando?.seccionId ?? "",
      modoFamilia: educando || familiaId ? "fija" : "nueva",
      responsables: [""],
      hermanoFamiliaId: "",
    });
  }, [abierto, educando, familiaId, reset]);

  const modo = watch("modoFamilia");
  const candidatos = useMemo(() => {
    const texto = plano(busquedaHermano.trim());
    if (!texto) return [];
    return (lista?.educandos ?? [])
      .filter((e) => e.familia && plano(`${e.nombre} ${e.apellidos}`).includes(texto))
      .slice(0, 6);
  }, [lista, busquedaHermano]);

  const guardar = handleSubmit(async (d) => {
    const comun = {
      nombre: d.nombre,
      apellidos: d.apellidos,
      fechaNacimiento: d.fechaNacimiento || null,
      seccionId: d.seccionId,
    };
    try {
      if (educando) {
        const res = await editar.mutateAsync({ id: educando.id, ...comun });
        alGuardar?.(res.educando.familiaId);
      } else {
        const familia =
          d.modoFamilia === "fija"
            ? { id: familiaId! }
            : d.modoFamilia === "hermano"
              ? { id: d.hermanoFamiliaId }
              : { nueva: { responsables: d.responsables.map((r) => r.trim()).filter(Boolean) } };
        const res = await crear.mutateAsync({ ...comun, familia });
        alGuardar?.(res.educando.familiaId);
      }
      onCambiar(false);
    } catch (error) {
      mostrarErroresDelServidor(error, setError, ["nombre", "apellidos", "fechaNacimiento", "seccionId"]);
    }
  });

  return (
    <Dialogo
      abierto={abierto}
      onCambiar={onCambiar}
      titulo={educando ? `Editar a ${educando.nombre}` : familiaId ? "Añadir hermano o hermana" : "Añadir educando"}
    >
      <form onSubmit={guardar} noValidate className="flex flex-col gap-5">
        {errors.root?.servidor && <Aviso tono="error">{errors.root.servidor.message}</Aviso>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" autoComplete="off" autoFocus error={errors.nombre?.message} {...register("nombre")} />
          <Campo etiqueta="Apellidos" autoComplete="off" error={errors.apellidos?.message} {...register("apellidos")} />
        </div>
        <Campo
          etiqueta="Fecha de nacimiento (opcional)"
          type="date"
          ayuda="Solo sirve para saber quién es el pequeño entre hermanos, por el precio de 2º hermano."
          error={errors.fechaNacimiento?.message}
          {...register("fechaNacimiento")}
        />
        <Controller
          control={control}
          name="seccionId"
          render={({ field }) => (
            <SelectorSeccion
              etiqueta={educando ? "Sección este curso" : "Sección"}
              valor={field.value}
              onCambiar={field.onChange}
              error={errors.seccionId?.message}
            />
          )}
        />

        {modo !== "fija" && (
          <Controller
            control={control}
            name="modoFamilia"
            render={({ field }) => (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-semibold">Familia</legend>
                <div role="radiogroup" aria-label="Familia" className="grid grid-cols-2 gap-2">
                  {[
                    { valor: "nueva", texto: "Familia nueva" },
                    { valor: "hermano", texto: "Ya tiene un hermano" },
                  ].map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      role="radio"
                      aria-checked={field.value === o.valor}
                      onClick={() => field.onChange(o.valor)}
                      className={cx(
                        "h-11 rounded-2xl text-sm font-semibold ring-1 transition",
                        field.value === o.valor ? "bg-bosque-claro text-bosque ring-bosque" : "bg-hundido text-suave ring-transparent hover:text-tinta",
                      )}
                    >
                      {o.texto}
                    </button>
                  ))}
                </div>

                {field.value === "nueva" ? (
                  <Controller
                    control={control}
                    name="responsables"
                    render={({ field: resp }) => (
                      <ResponsablesCampos
                        valor={resp.value}
                        onCambiar={resp.onChange}
                        errores={(errors.responsables as { message?: string }[] | undefined)?.map((e) => e?.message) ?? []}
                      />
                    )}
                  />
                ) : (
                  <Controller
                    control={control}
                    name="hermanoFamiliaId"
                    render={({ field: hermano }) => (
                      <div className="flex flex-col gap-2">
                        <label className="relative">
                          <span className="sr-only">Buscar a su hermano o hermana</span>
                          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-suave" aria-hidden />
                          <input
                            type="search"
                            value={busquedaHermano}
                            onChange={(e) => setBusquedaHermano(e.target.value)}
                            placeholder="Busca a su hermano o hermana…"
                            className="h-12 w-full rounded-2xl bg-superficie pr-4 pl-11 text-base ring-1 ring-linea placeholder:text-suave focus:outline-none focus:ring-2 focus:ring-bosque"
                          />
                        </label>
                        {candidatos.length > 0 && (
                          <div role="radiogroup" aria-label="Hermano o hermana" className="flex flex-col gap-1">
                            {candidatos.map((c) => {
                              const elegido = hermano.value === c.familia!.id;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  role="radio"
                                  aria-checked={elegido}
                                  onClick={() => hermano.onChange(c.familia!.id)}
                                  className={cx(
                                    "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ring-1",
                                    elegido ? "bg-bosque-claro ring-bosque" : "ring-transparent hover:bg-hundido",
                                  )}
                                >
                                  <span>
                                    <span className="font-semibold">{c.nombre} {c.apellidos}</span>
                                    <span className="block text-xs text-suave">{c.familia!.nombre}</span>
                                  </span>
                                  {elegido && <Check className="size-4 text-bosque" aria-hidden />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {errors.hermanoFamiliaId && <p className="text-sm font-medium text-rojo">{errors.hermanoFamiliaId.message}</p>}
                      </div>
                    )}
                  />
                )}
              </fieldset>
            )}
          />
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={() => onCambiar(false)}>Cancelar</Boton>
          <Boton type="submit" cargando={isSubmitting}>{educando ? "Guardar" : "Añadir"}</Boton>
        </div>
      </form>
    </Dialogo>
  );
};
