// Mismo formato que la API (backend/src/modules/movimientos/movimientos.types.ts).
export type EstadoMovimiento = "CLASIFICADO" | "DUDA" | "OTRO_INGRESO" | "CRUZADO";

export type MedioPago = "EFECTIVO" | "BIZUM" | "TRANSFERENCIA" | "OTRO";

export type MotivoDuda =
  | "PAGADOR_DESCONOCIDO"
  | "FAMILIA_SIN_CONFIRMAR"
  | "NO_CUADRA"
  | "VARIAS_COMBINACIONES"
  | "POSIBLE_YA_MARCADO"
  | "POSIBLE_YA_APUNTADO"
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

export type OrigenMovimiento = "BANCO" | "LISTADO" | "MANUAL";

// Un pago a mano o una marca del listado: candidato a cruzar con uno del banco, o ya cruzado (D-51).
export type Apuntado = {
  id: string;
  origen: OrigenMovimiento;
  fecha: string | null;
  concepto: string;
  medio: MedioPago | null;
  importeCentimos: number;
};

export type Movimiento = Omit<MovimientoPrevisto, "fecha"> & {
  id: string;
  origen: OrigenMovimiento;
  fecha: string | null;
  medio: MedioPago | null;
  nota: string | null;
  // D-48: lo que no se repartió y queda como saldo de la familia.
  sobranteCentimos: number;
  cruce: Apuntado | null;
  clasificadoPor: string | null;
  clasificadoEn: string | null;
};

export type ListaMovimientos = {
  contadores: { dudas: number; clasificados: number; otros: number };
  movimientos: Movimiento[];
};

export type DetalleMovimiento = {
  movimiento: Movimiento;
  // Si el nombre de quien paga ya está aprendido, para qué familia (D-1).
  pagadorConocido: { familiaId: string } | null;
  candidatosCruce: Apuntado[];
};

export type AsignacionPedida = { cargoId: string; importeCentimos: number };
