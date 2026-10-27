import type { EstadoMovimiento, MotivoDuda, OrigenMovimiento } from "@prisma/client";

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

export type MovimientoVista = Omit<MovimientoPrevisto, "fecha"> & {
  id: string;
  origen: OrigenMovimiento;
  fecha: string | null;
  // Nulo en un clasificado = lo clasifico la app sola.
  clasificadoPor: string | null;
  clasificadoEn: string | null;
};
