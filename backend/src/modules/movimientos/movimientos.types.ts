import type { EstadoMovimiento, MedioPago, MotivoDuda, OrigenMovimiento } from "@prisma/client";

// Un cargo pagado (clasificado) o sugerido (en Dudas) por un movimiento.
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

// D-41: lo que se ve antes de confirmar (y lo que devuelve la confirmacion).
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

// Un pago a mano o una marca del listado (candidatos a cruzar, o el cruzado con uno del banco: D-51).
export type Apuntado = {
  id: string;
  origen: OrigenMovimiento;
  fecha: string | null;
  concepto: string;
  medio: MedioPago | null;
  importeCentimos: number;
};

export type MovimientoVista = Omit<MovimientoPrevisto, "fecha"> & {
  id: string;
  origen: OrigenMovimiento;
  fecha: string | null;
  medio: MedioPago | null;
  nota: string | null;
  // D-48: lo que no se repartio y queda como saldo de la familia.
  sobranteCentimos: number;
  // D-51: el pago a mano o la marca que resulto ser este mismo dinero.
  cruce: Apuntado | null;
  // Nulo en un clasificado = lo clasifico la app sola.
  clasificadoPor: string | null;
  clasificadoEn: string | null;
};
