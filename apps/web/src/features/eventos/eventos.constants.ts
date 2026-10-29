import type { EstadoCargo, TipoEvento } from "./eventos.types";

export const TIPOS_EVENTO: { valor: Exclude<TipoEvento, "PEDIDO">; etiqueta: string; descripcion: string }[] = [
  {
    valor: "TODA_SECCION",
    etiqueta: "Toda la sección",
    descripcion: "Cuota, censo… Deben pagarlo todos los niños de las secciones elegidas, también los que entren después.",
  },
  {
    valor: "CON_APUNTADOS",
    etiqueta: "Con apuntados",
    descripcion: "Acampadas, campamentos… Solo lo pagan los niños que marques como asistentes.",
  },
];

export const ETIQUETA_TIPO = { ...Object.fromEntries(TIPOS_EVENTO.map((t) => [t.valor, t.etiqueta])), PEDIDO: "Pedido" } as Record<TipoEvento, string>;

/** Un pedido tiene su propia pantalla (D-66). */
export const rutaDeEvento = (e: { id: string; tipo: TipoEvento }) => (e.tipo === "PEDIDO" ? `/eventos/pedidos/${e.id}` : `/eventos/${e.id}`);

// Estado de cada cargo: texto y colores del tema.
export const ESTADOS: Record<EstadoCargo, { etiqueta: string; clase: string }> = {
  PENDIENTE: { etiqueta: "Pendiente", clase: "bg-rojo-claro text-rojo" },
  PARCIAL: { etiqueta: "A medias", clase: "bg-ambar-claro text-[color-mix(in_oklch,var(--color-ambar)_65%,var(--color-tinta))]" },
  PAGADO: { etiqueta: "Pagado", clase: "bg-bosque-claro text-bosque" },
  EXENTO: { etiqueta: "Exento", clase: "bg-azul-claro text-azul" },
};
