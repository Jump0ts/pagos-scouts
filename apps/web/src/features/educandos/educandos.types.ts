import type { EstadoCargo } from "@/features/eventos/eventos.types";
import type { Movimiento } from "@/features/movimientos/movimientos.types";

export type EducandoDeLista = {
  id: string;
  nombre: string;
  apellidos: string;
  seccionId: string;
  // No llega a los scouters (D-32).
  familia?: { id: string; nombre: string };
};

export type ListaEducandos = {
  curso: { id: string; nombre: string } | null;
  educandos: EducandoDeLista[];
};

// Lo que debe y ha pagado en un evento del curso activo (D-41).
export type CargoEnFicha = {
  id: string;
  evento: { id: string; nombre: string };
  importeCentimos: number;
  pagadoCentimos: number;
  estado: EstadoCargo;
};

export type HijoEnFicha = {
  id: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: string | null;
  seccionId: string | null;
  deBaja: boolean;
  cargos: CargoEnFicha[];
};

export type PagoEnFicha = Pick<Movimiento, "id" | "origen" | "medio" | "fecha" | "concepto" | "importeCentimos">;

export type FichaFamilia = {
  id: string;
  nombre: string;
  responsables: { id: string; nombreCompleto: string }[];
  educandos: HijoEnFicha[];
  pagos: PagoEnFicha[];
  // D-48 y D-1: saldo a favor y nombres de quien paga aprendidos.
  saldoCentimos: number;
  pagadores: { id: string; nombre: string }[];
};

// A que familia va un niño al darlo de alta o moverlo.
export type DestinoFamilia = { id: string } | { nueva: { responsables: string[] } };
