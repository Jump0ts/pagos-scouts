import type { MedioPago } from "@/features/movimientos/movimientos.types";

// D-66: los pedidos se crean y se ven en su propia pantalla (features/pedidos).
export type TipoEvento = "TODA_SECCION" | "CON_APUNTADOS" | "PEDIDO";
export type EstadoCargo = "PENDIENTE" | "PARCIAL" | "PAGADO" | "EXENTO";

export type Evento = {
  id: string;
  nombre: string;
  tipo: TipoEvento;
  fechaInicio: string;
  fechaFin: string;
  cerrado: boolean;
  descuentoHermanos: boolean;
  precioSegundoCentimos: number | null;
  precioTerceroCentimos: number | null;
  precios: { seccionId: string; importeCentimos: number }[];
};

export type Resumen = { debidoCentimos: number; pagadoCentimos: number; ninos: number; alDia: number };

export type EventoConResumen = Evento & { resumen: Resumen };

export type CargoVista = {
  id: string;
  educando: { id: string; nombre: string; apellidos: string };
  seccionId: string;
  importeCentimos: number;
  importeCalculadoCentimos: number;
  ajustado: boolean;
  // No llega a los scouters (D-35, D-38).
  motivoAjuste?: string | null;
  posicionHermano: number;
  pagadoCentimos: number;
  estado: EstadoCargo;
};

export type DetalleEvento = { evento: Evento; resumen: Resumen; excluidos: number; cargos: CargoVista[] };

export type DatosEvento = {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  precios: { seccionId: string; importeCentimos: number }[];
  descuentoHermanos: boolean;
  precioSegundoCentimos: number | null;
  precioTerceroCentimos: number | null;
};

// D-56: un pago que cubre (parte de) un cargo.
export type PagoDeCargo = {
  movimientoId: string;
  origen: "BANCO" | "LISTADO" | "MANUAL";
  fecha: string | null;
  concepto: string;
  medio: MedioPago | null;
  importeCentimos: number;
  cruce: { origen: "LISTADO" | "MANUAL"; medio: MedioPago | null } | null;
};
