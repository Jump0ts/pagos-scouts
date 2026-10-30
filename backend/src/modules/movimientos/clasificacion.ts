// Motor de clasificacion (D-5, D-43): el prototipo (prototipo/conciliar.py) pasado a la app. Sin base de datos: se
// prueba aparte. Decide de quien es un ingreso y que cargos paga; si hay cualquier duda, no decide y sugiere.
import type { MotivoDuda } from "@prisma/client";
import { contiene, tokens, type Persona } from "../../utils/nombres.js";

export type FamiliaConocida = { id: string; responsables: Persona[]; apellidosHijos: string[] };

// Lo que le falta a un cargo. "orden" prioriza los eventos mas antiguos al sugerir una combinacion.
export type CargoPendiente = { cargoId: string; pendienteCentimos: number; orden: number };

export type Contexto = {
  // D-1: pagadores aprendidos (clave del nombre -> familia).
  pagadores: Map<string, string>;
  familias: FamiliaConocida[];
  // Por familia, sus cargos con algo pendiente, de cualquier curso (D-82). Se actualiza al clasificar cada movimiento.
  pendientes: Map<string, CargoPendiente[]>;
  // Familias con pagos marcados en el listado (D-44).
  conMarcas: Set<string>;
  // D-51: por familia, los pagos a mano y las marcas del listado que aun no estan cruzados con uno del banco.
  apuntados: Map<string, Apuntado[]>;
};

export type Apuntado = { id: string; origen: "MANUAL" | "LISTADO"; importeCentimos: number };

export type AsignacionPropuesta = { cargoId: string; importeCentimos: number };

export type Clasificacion =
  | { estado: "CLASIFICADO"; familiaId: string; asignaciones: AsignacionPropuesta[] }
  | { estado: "DUDA"; motivo: MotivoDuda; familiaId: string | null; cargosSugeridos: string[] };

/** "Luis Gil Ferrer" y "GIL FERRER LUIS" dan la misma clave. */
export const clavePagador = (nombre: string) => tokens(nombre).sort().join(" ");

const ALTA = 3;
const MEDIA = 2;
const BAJA = 1;

// Un padre o madre del listado frente al nombre que trae el banco (en cualquier orden).
const nivelAdulto = (adulto: Persona, pagador: string[]) => {
  if (!adulto.apellidos.length) return 0;
  const nombre = adulto.nombres.some((n) => contiene(n, pagador));
  const apellidos = adulto.apellidos.filter((a) => contiene(a, pagador)).length;
  if (nombre && apellidos === adulto.apellidos.length && apellidos >= 2) return ALTA;
  if ((nombre && apellidos) || apellidos >= 2) return MEDIA;
  return apellidos ? BAJA : 0;
};

const nivelFamilia = (familia: FamiliaConocida, pagador: string[]) => {
  const nivel = Math.max(0, ...familia.responsables.map((r) => nivelAdulto(r, pagador)));
  // Pista debil: los hijos suelen llevar el primer apellido de cada progenitor.
  if (!nivel && familia.apellidosHijos.some((a) => contiene(a, pagador))) return BAJA;
  return nivel;
};

/**
 * Combinaciones de cargos que suman exactamente el importe, pagando cada uno entero. Para en `maximo`: solo
 * interesa saber si hay una sola. Las primeras usan los cargos mas antiguos.
 */
export const combinaciones = (cargos: CargoPendiente[], importe: number, maximo = 2) => {
  const lista = cargos.filter((c) => c.pendienteCentimos > 0).sort((a, b) => a.orden - b.orden).slice(0, 30);
  const restoDesde = lista.map((_, i) => lista.slice(i).reduce((n, c) => n + c.pendienteCentimos, 0));
  const encontradas: CargoPendiente[][] = [];
  const buscar = (i: number, resto: number, elegidos: CargoPendiente[]) => {
    if (encontradas.length >= maximo) return;
    if (resto === 0) {
      encontradas.push(elegidos);
      return;
    }
    if (i >= lista.length || resto < 0 || restoDesde[i] < resto) return;
    buscar(i + 1, resto - lista[i].pendienteCentimos, [...elegidos, lista[i]]);
    buscar(i + 1, resto, elegidos);
  };
  if (importe > 0) buscar(0, importe, []);
  return encontradas;
};

const ids = (combinacion: CargoPendiente[] | undefined) => combinacion?.map((c) => c.cargoId) ?? [];

export const clasificar = (concepto: string, importeCentimos: number, contexto: Contexto): Clasificacion => {
  const pagador = tokens(concepto);
  const opcionesDe = (familiaId: string) => combinaciones(contexto.pendientes.get(familiaId) ?? [], importeCentimos);

  // 1) La familia: pagador aprendido o, si no, el nombre comparado con los responsables del listado.
  let segura = contexto.pagadores.get(clavePagador(concepto)) ?? null;
  if (!segura) {
    const niveles = contexto.familias
      .map((f) => ({ id: f.id, nivel: nivelFamilia(f, pagador) }))
      .filter((f) => f.nivel > 0);
    const mejor = Math.max(0, ...niveles.map((f) => f.nivel));
    const empatadas = niveles.filter((f) => f.nivel === mejor);
    if (!mejor) return { estado: "DUDA", motivo: "PAGADOR_DESCONOCIDO", familiaId: null, cargosSugeridos: [] };
    if (mejor < ALTA || empatadas.length > 1) {
      const sugerida = empatadas.length === 1 ? empatadas[0].id : null;
      return {
        estado: "DUDA",
        motivo: "FAMILIA_SIN_CONFIRMAR",
        familiaId: sugerida,
        cargosSugeridos: sugerida ? ids(opcionesDe(sugerida)[0]) : [],
      };
    }
    segura = empatadas[0].id;
  }

  // 2) Si ya hay apuntado un pago de ese importe (a mano o en el listado), puede ser el mismo dinero: lo decide
  // una persona (D-51). Cada apuntado solo puede avisar a un movimiento.
  const apuntados = contexto.apuntados.get(segura) ?? [];
  const igual = apuntados.find((a) => a.importeCentimos === importeCentimos);
  if (igual) {
    contexto.apuntados.set(segura, apuntados.filter((a) => a !== igual));
    const motivo = igual.origen === "MANUAL" ? "POSIBLE_YA_APUNTADO" : "POSIBLE_YA_MARCADO";
    return { estado: "DUDA", motivo, familiaId: segura, cargosSugeridos: [] };
  }

  // 3) Los cargos: solo si una unica combinacion de lo pendiente suma exactamente el importe.
  const opciones = opcionesDe(segura);
  if (opciones.length === 1) {
    const asignaciones = opciones[0].map((c) => ({ cargoId: c.cargoId, importeCentimos: c.pendienteCentimos }));
    return { estado: "CLASIFICADO", familiaId: segura, asignaciones };
  }
  if (opciones.length > 1) {
    return { estado: "DUDA", motivo: "VARIAS_COMBINACIONES", familiaId: segura, cargosSugeridos: ids(opciones[0]) };
  }
  const motivo = contexto.conMarcas.has(segura) ? "POSIBLE_YA_MARCADO" : "NO_CUADRA";
  return { estado: "DUDA", motivo, familiaId: segura, cargosSugeridos: [] };
};

/** Tras clasificar un movimiento, lo pagado deja de estar pendiente para los siguientes. */
export const descontar = (contexto: Contexto, familiaId: string, asignaciones: AsignacionPropuesta[]) => {
  const pagado = new Map(asignaciones.map((a) => [a.cargoId, a.importeCentimos]));
  const lista = contexto.pendientes.get(familiaId) ?? [];
  contexto.pendientes.set(
    familiaId,
    lista
      .map((c) => ({ ...c, pendienteCentimos: c.pendienteCentimos - (pagado.get(c.cargoId) ?? 0) }))
      .filter((c) => c.pendienteCentimos > 0),
  );
};
