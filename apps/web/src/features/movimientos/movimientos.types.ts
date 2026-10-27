// Mismo formato que la API (backend/src/modules/movimientos/movimientos.types.ts).
export type EstadoMovimiento = "CLASIFICADO" | "DUDA";

export type MotivoDuda =
  | "PAGADOR_DESCONOCIDO"
  | "FAMILIA_SIN_CONFIRMAR"
  | "NO_CUADRA"
  | "VARIAS_COMBINACIONES"
  | "POSIBLE_YA_MARCADO"
  | "DESHECHO";

export type CargoDeMovimiento = { cargoId: string; evento: string; educando: string; importeCentimos: number };

export type MovimientoPrevisto = {
  fecha: string;
  concepto: string;
  importeCentimos: number;
  estado: EstadoMovimiento;
  motivo: MotivoDuda | null;
  familia: { id: string; nombre: string } | null;
  cargos: CargoDeMovimiento[];
};

export type ResumenImportacion = {
  nuevos: number;
  yaImportados: number;
  salidasIgnoradas: number;
  clasificados: number;
  dudas: number;
  desde: string | null;
  hasta: string | null;
  movimientos: MovimientoPrevisto[];
};

export type Movimiento = Omit<MovimientoPrevisto, "fecha"> & {
  id: string;
  origen: "BANCO" | "LISTADO";
  fecha: string | null;
  clasificadoPor: string | null;
  clasificadoEn: string | null;
};

export type ListaMovimientos = {
  contadores: { dudas: number; clasificados: number };
  movimientos: Movimiento[];
};
