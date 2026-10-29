import type { EstadoCargo } from "@/features/eventos/eventos.types";

// D-66: el catalogo de un pedido.
export type TipoOpcion = "LISTA" | "TEXTO";
export type Valor = { id: string; valor: string; suplementoCentimos: number };
export type Opcion = {
  id: string;
  nombre: string;
  tipo: TipoOpcion;
  obligatoria: boolean;
  maxLongitud: number | null;
  suplementoCentimos: number;
  valores: Valor[];
};
export type Articulo = { id: string; nombre: string; precioCentimos: number; maxUnidades: number; opciones: Opcion[] };

// Lo elegido para una unidad, tal como se guardo (cambiar el catalogo no lo cambia).
export type Eleccion = { opcion: string; tipo: TipoOpcion; valor: string; suplementoCentimos: number };
export type LineaVista = { articulo: string; elecciones: Eleccion[]; importeCentimos: number };

// Lo que se manda para una unidad: un valor de cada lista y el texto de cada opcion de texto.
export type EleccionEntrada = { opcionId: string; valorId?: string; texto?: string };
export type LineaEntrada = { articuloId: string; elecciones: EleccionEntrada[] };

export type PersonaPedido = {
  cargoId: string;
  educando: { id: string; nombre: string; apellidos: string };
  seccionId: string;
  importeCentimos: number;
  pagadoCentimos: number;
  estado: EstadoCargo;
  lineas: (LineaVista & { id: string })[];
};

export type ResumenProveedor = {
  unidades: { articulo: string; opciones: string; unidades: number }[];
  textos: { articulo: string; opciones: string; texto: string }[];
};

export type DetallePedido = {
  pedido: {
    id: string;
    nombre: string;
    fechaInicio: string;
    fechaFin: string;
    instruccionesPago: string | null;
    cerrado: boolean;
    formularioAbierto: boolean;
    // Solo para Admin y Tesoreria.
    enlace?: string;
    pendientes?: number;
    articulos: Articulo[];
  };
  resumen: { debidoCentimos: number; pagadoCentimos: number; personas: number; unidades: number };
  personas: PersonaPedido[];
  proveedor: ResumenProveedor;
};

export type Semaforo = "RECONOCIDO" | "DUDOSO" | "SIN_COINCIDENCIA";
export type Candidato = { educandoId: string; nombre: string; apellidos: string; seccionId: string };
export type Envio = {
  id: string;
  creadoEn: string;
  nombre: string;
  apellidos: string;
  seccionId: string;
  lineas: LineaVista[];
  totalCentimos: number;
  semaforo: Semaforo;
  candidatos: Candidato[];
  posibleCambio: boolean;
};

// Lo que se manda al crear o editar el catalogo: lo nuevo, sin id.
export type ValorEntrada = { id?: string; valor: string; suplementoCentimos: number };
export type OpcionEntrada = Omit<Opcion, "id" | "valores"> & { id?: string; valores: ValorEntrada[] };
export type ArticuloEntrada = Omit<Articulo, "id" | "opciones"> & { id?: string; opciones: OpcionEntrada[] };
export type DatosPedido = {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  instruccionesPago: string | null;
  articulos: ArticuloEntrada[];
};

// El formulario publico.
export type FormularioPublico = {
  grupo: string;
  pedido: { nombre: string; fechaFin: string; instruccionesPago: string | null };
  secciones: { id: string; nombre: string }[];
  articulos: Articulo[];
  ticket: string;
};
export type ResumenEnvio = { resumen: { nombre: string; lineas: LineaVista[]; totalCentimos: number }; instruccionesPago: string | null };
