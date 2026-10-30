import * as Menu from "@radix-ui/react-dropdown-menu";
import { Ellipsis, Pencil, Plus, RotateCcw, Split, Trash2, UserMinus } from "lucide-react";
import { useEffect, useState } from "react";
import { Aviso } from "@/components/Aviso";
import { Boton } from "@/components/Boton";
import { Cargando } from "@/components/Cargando";
import { Confirmar } from "@/components/Confirmar";
import { Dialogo } from "@/components/Dialogo";
import { usePerfil } from "@/features/auth/useSesion";
import { ESTADOS } from "@/features/eventos/eventos.constants";
import { ETIQUETA_MEDIO } from "@/features/movimientos/movimientos.constants";
import { ChipSeccion } from "@/features/secciones/ChipSeccion";
import { useSecciones } from "@/features/secciones/secciones.api";
import { mensajeDeError } from "@/utils/api";
import { cx } from "@/utils/cx";
import { euros } from "@/utils/dinero";
import { EducandoDialogo } from "./EducandoDialogo";
import {
  useAplicarSaldo, useBorrarEducando, useBorrarFamilia, useCambiarBaja, useEditarEducando, useEditarFamilia, useFichaFamilia,
  useOlvidarPagador,
} from "./educandos.api";
import type { HijoEnFicha, PagoEnFicha } from "./educandos.types";
import { ResponsablesCampos } from "./ResponsablesCampos";

const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

// Cómo llegó un pago: "Banco", "A mano · Efectivo", "Listado".
const origenPago = (p: PagoEnFicha) =>
  p.origen === "BANCO" ? "Banco" : p.origen === "LISTADO" ? "Listado" : `A mano${p.medio ? ` · ${ETIQUETA_MEDIO[p.medio]}` : ""}`;

const claseItem = "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-hundido";

type Pendiente =
  | { tipo: "borrar-hijo"; hijo: HijoEnFicha }
  | { tipo: "separar"; hijo: HijoEnFicha }
  | { tipo: "borrar-familia" }
  | null;

export const FichaFamiliaDialogo = ({ familiaId, onCerrar }: { familiaId: string | null; onCerrar: () => void }) => {
  const { grupoActivo } = usePerfil();
  const esAdmin = grupoActivo?.rol === "ADMIN";
  const { data: familia, isPending, error } = useFichaFamilia(familiaId);
  const { data: secciones = [] } = useSecciones();
  const editarFamilia = useEditarFamilia();
  const baja = useCambiarBaja();
  const borrarHijo = useBorrarEducando();
  const borrarFamilia = useBorrarFamilia();
  const aplicarSaldo = useAplicarSaldo();
  const olvidarPagador = useOlvidarPagador();
  const moverHijo = useEditarEducando();

  const [editando, setEditando] = useState(false);
  const [responsables, setResponsables] = useState<string[]>([]);
  const [nombre, setNombre] = useState("");
  const [hijoEditado, setHijoEditado] = useState<HijoEnFicha | null>(null);
  const [anadiendoHermano, setAnadiendoHermano] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente>(null);

  useEffect(() => {
    setEditando(false);
    setPendiente(null);
  }, [familiaId]);

  const empezarEdicion = () => {
    if (!familia) return;
    setNombre(familia.nombre);
    setResponsables(familia.responsables.map((r) => r.nombreCompleto));
    setEditando(true);
  };

  const guardarEdicion = async () => {
    if (!familia) return;
    await editarFamilia.mutateAsync({
      id: familia.id,
      nombre: nombre.trim(),
      responsables: responsables.map((r) => r.trim()).filter(Boolean),
    });
    setEditando(false);
  };

  const seccion = (id: string | null) => secciones.find((s) => s.id === id);
  const ultimoHijo = (familia?.educandos.length ?? 0) <= 1;

  return (
    <>
      <Dialogo
        abierto={familiaId !== null}
        onCambiar={(v) => !v && onCerrar()}
        titulo={familia?.nombre ?? "Familia"}
        descripcion={familia ? `${familia.educandos.length} ${familia.educandos.length === 1 ? "hijo" : "hijos"} en el grupo` : undefined}
      >
        {isPending ? (
          <Cargando />
        ) : error || !familia ? (
          <Aviso tono="error">{mensajeDeError(error)}</Aviso>
        ) : (
          <div className="flex flex-col gap-6">
            <section aria-labelledby="ficha-responsables" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h3 id="ficha-responsables" className="text-xs font-bold tracking-[.12em] text-suave uppercase">Responsables</h3>
                {!editando && (
                  <Boton variante="fantasma" tamano="pequeno" onClick={empezarEdicion}>
                    <Pencil className="size-4" aria-hidden /> Editar
                  </Boton>
                )}
              </div>
              {editando ? (
                <div className="flex flex-col gap-4 rounded-2xl bg-hundido p-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold">Nombre de la familia</span>
                    <input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="h-12 rounded-2xl bg-superficie px-4 text-base ring-1 ring-linea focus:outline-none focus:ring-2 focus:ring-bosque"
                    />
                  </label>
                  <ResponsablesCampos valor={responsables} onCambiar={setResponsables} />
                  {editarFamilia.error && <Aviso tono="error">{mensajeDeError(editarFamilia.error)}</Aviso>}
                  <div className="flex justify-end gap-2">
                    <Boton variante="secundario" tamano="pequeno" onClick={() => setEditando(false)}>Cancelar</Boton>
                    <Boton tamano="pequeno" cargando={editarFamilia.isPending} onClick={guardarEdicion}>Guardar</Boton>
                  </div>
                </div>
              ) : familia.responsables.length ? (
                <ul className="flex flex-col gap-1">
                  {familia.responsables.map((r) => (
                    <li key={r.id} className="font-semibold">{r.nombreCompleto}</li>
                  ))}
                </ul>
              ) : (
                <Aviso tono="info">
                  Sin responsables apuntados: sus pagos no se podrán reconocer por el nombre de quien paga.
                </Aviso>
              )}
            </section>

            <section aria-labelledby="ficha-hijos" className="flex flex-col gap-3">
              <h3 id="ficha-hijos" className="text-xs font-bold tracking-[.12em] text-suave uppercase">Hijos en el grupo</h3>
              <ul className="divide-y divide-linea overflow-hidden rounded-2xl ring-1 ring-linea">
                {familia.educandos.map((hijo) => {
                  const suya = seccion(hijo.seccionId);
                  return (
                    <li key={hijo.id} className="flex items-center gap-3 py-2.5 pr-1.5 pl-4">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{hijo.nombre} {hijo.apellidos}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          {suya ? <ChipSeccion seccion={suya} /> : <span className="text-xs text-suave">Sin sección este curso</span>}
                          {hijo.deBaja && <span className="rounded-full bg-rojo-claro px-2 py-0.5 text-xs font-semibold text-rojo">De baja</span>}
                        </span>
                        {hijo.cargos.length > 0 && (
                          <ul className="mt-2 flex flex-col gap-1" aria-label={`Pagos de ${hijo.nombre}`}>
                            {hijo.cargos.map((c) => (
                              <li key={c.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                                <span className="min-w-0 truncate">
                                  {c.evento.nombre}
                                  {c.cursoAnterior && <span className="text-suave tabular-nums"> · {c.cursoAnterior}</span>}
                                </span>
                                <span className="text-suave tabular-nums">
                                  {c.estado === "PARCIAL" ? `${euros(c.pagadoCentimos)} de ${euros(c.importeCentimos)}` : euros(c.importeCentimos)}
                                </span>
                                <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", ESTADOS[c.estado].clase)}>
                                  {ESTADOS[c.estado].etiqueta}
                                </span>
                                {familia.saldoCentimos > 0 && (c.estado === "PENDIENTE" || c.estado === "PARCIAL") && (
                                  <button
                                    type="button"
                                    disabled={aplicarSaldo.isPending}
                                    onClick={() => aplicarSaldo.mutate({ familiaId: familia.id, cargoId: c.id })}
                                    className="rounded-full px-2 py-0.5 text-xs font-semibold text-azul ring-1 ring-azul/40 hover:bg-azul-claro disabled:opacity-50"
                                  >
                                    Usar saldo<span className="sr-only"> en {c.evento.nombre} de {hijo.nombre}</span>
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </span>
                      <Menu.Root>
                        <Menu.Trigger
                          aria-label={`Acciones para ${hijo.nombre}`}
                          className="grid size-10 shrink-0 place-items-center rounded-full text-suave hover:bg-hundido hover:text-tinta"
                        >
                          <Ellipsis className="size-5" aria-hidden />
                        </Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Content align="end" sideOffset={6} className="z-[60] min-w-60 rounded-2xl bg-superficie p-1.5 shadow-xl ring-1 ring-linea">
                            <Menu.Item className={claseItem} onSelect={() => setHijoEditado(hijo)}>
                              <Pencil className="size-4 text-suave" aria-hidden /> Editar datos y sección
                            </Menu.Item>
                            <Menu.Item className={claseItem} onSelect={() => baja.mutate({ id: hijo.id, baja: !hijo.deBaja })}>
                              {hijo.deBaja ? <RotateCcw className="size-4 text-suave" aria-hidden /> : <UserMinus className="size-4 text-suave" aria-hidden />}
                              {hijo.deBaja ? "Reincorporar este curso" : "Dar de baja este curso"}
                            </Menu.Item>
                            {!ultimoHijo && (
                              <Menu.Item className={claseItem} onSelect={() => setPendiente({ tipo: "separar", hijo })}>
                                <Split className="size-4 text-suave" aria-hidden /> No es de esta familia
                              </Menu.Item>
                            )}
                            {esAdmin && (
                              <>
                                <Menu.Separator className="my-1 h-px bg-linea" />
                                <Menu.Item className={`${claseItem} text-rojo`} onSelect={() => setPendiente({ tipo: "borrar-hijo", hijo })}>
                                  <Trash2 className="size-4" aria-hidden /> Borrar definitivamente
                                </Menu.Item>
                              </>
                            )}
                          </Menu.Content>
                        </Menu.Portal>
                      </Menu.Root>
                    </li>
                  );
                })}
              </ul>
              {baja.error && <Aviso tono="error">{mensajeDeError(baja.error)}</Aviso>}
              <Boton variante="secundario" tamano="pequeno" className="w-fit" onClick={() => setAnadiendoHermano(true)}>
                <Plus className="size-4" aria-hidden /> Añadir hermano o hermana
              </Boton>
            </section>

            <section aria-labelledby="ficha-pagos" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="ficha-pagos" className="text-xs font-bold tracking-[.12em] text-suave uppercase">Pagos recibidos</h3>
                {familia.saldoCentimos > 0 && (
                  <span className="rounded-full bg-azul-claro px-2.5 py-0.5 text-xs font-semibold text-azul">
                    Saldo a favor: {euros(familia.saldoCentimos)}
                  </span>
                )}
              </div>
              {aplicarSaldo.error && <Aviso tono="error">{mensajeDeError(aplicarSaldo.error)}</Aviso>}
              {familia.pagos.length ? (
                <ul className="divide-y divide-linea overflow-hidden rounded-2xl ring-1 ring-linea">
                  {familia.pagos.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{p.concepto}</span>
                        <span className="text-xs text-suave">
                          {origenPago(p)} · {p.fecha ? fechaLarga(p.fecha) : "sin fecha"}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{euros(p.importeCentimos)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-suave">Aún no hay pagos de esta familia.</p>
              )}
            </section>

            {familia.pagadores.length > 0 && (
              <section aria-labelledby="ficha-pagadores" className="flex flex-col gap-3">
                <h3 id="ficha-pagadores" className="text-xs font-bold tracking-[.12em] text-suave uppercase">Quién paga (aprendido)</h3>
                <ul className="flex flex-col gap-1">
                  {familia.pagadores.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold">{p.nombre}</span>
                      <Boton
                        variante="fantasma"
                        tamano="pequeno"
                        disabled={olvidarPagador.isPending}
                        onClick={() => olvidarPagador.mutate({ familiaId: familia.id, pagadorId: p.id })}
                        aria-label={`Olvidar a ${p.nombre}`}
                      >
                        Olvidar
                      </Boton>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-suave">Los pagos de estos nombres se reconocen solos como de esta familia.</p>
              </section>
            )}

            {esAdmin && (
              <div className="border-t border-linea pt-4">
                <Boton variante="fantasma" tamano="pequeno" className="text-rojo" onClick={() => setPendiente({ tipo: "borrar-familia" })}>
                  <Trash2 className="size-4" aria-hidden /> Borrar la familia y sus hijos
                </Boton>
              </div>
            )}
          </div>
        )}
      </Dialogo>

      {familia && (
        <>
          <EducandoDialogo
            abierto={hijoEditado !== null}
            onCambiar={(v) => !v && setHijoEditado(null)}
            educando={hijoEditado ?? undefined}
          />
          <EducandoDialogo abierto={anadiendoHermano} onCambiar={setAnadiendoHermano} familiaId={familia.id} />
        </>
      )}

      <Confirmar
        abierto={pendiente?.tipo === "separar"}
        onCambiar={(v) => !v && setPendiente(null)}
        titulo={pendiente?.tipo === "separar" ? `¿Sacar a ${pendiente.hijo.nombre} de esta familia?` : ""}
        descripcion="Pasará a una familia nueva, sin responsables. Después podrás apuntar a sus padres desde su ficha."
        accion="Sacar de la familia"
        onConfirmar={async () => {
          if (pendiente?.tipo === "separar") await moverHijo.mutateAsync({ id: pendiente.hijo.id, familia: { nueva: { responsables: [] } } });
        }}
      />
      <Confirmar
        abierto={pendiente?.tipo === "borrar-hijo"}
        onCambiar={(v) => !v && setPendiente(null)}
        titulo={pendiente?.tipo === "borrar-hijo" ? `¿Borrar a ${pendiente.hijo.nombre} definitivamente?` : ""}
        descripcion={`Se borran todos sus datos y no se puede deshacer. Si solo deja el grupo, mejor dale de baja.${ultimoHijo ? " Es el último hijo: la familia también se borrará." : ""}`}
        accion="Borrar"
        peligrosa
        onConfirmar={async () => {
          if (pendiente?.tipo !== "borrar-hijo") return;
          await borrarHijo.mutateAsync(pendiente.hijo.id);
          if (ultimoHijo) onCerrar();
        }}
      />
      <Confirmar
        abierto={pendiente?.tipo === "borrar-familia"}
        onCambiar={(v) => !v && setPendiente(null)}
        titulo={`¿Borrar ${familia?.nombre ?? "la familia"}?`}
        descripcion="Se borran la familia, sus responsables y todos sus hijos. No se puede deshacer."
        accion="Borrar todo"
        peligrosa
        onConfirmar={async () => {
          if (!familia) return;
          await borrarFamilia.mutateAsync(familia.id);
          onCerrar();
        }}
      />
    </>
  );
};
