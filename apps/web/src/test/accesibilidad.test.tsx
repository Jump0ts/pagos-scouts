import { screen } from "@testing-library/react";
import axe from "axe-core";
import { PERFIL_ADMIN, renderizar, SECCIONES, simularApi } from "./renderizar";

// D-75: axe revisa cada pantalla principal y el test falla si aparece un problema de accesibilidad (etiquetas,
// roles, nombres, estructura). El contraste no se puede medir en jsdom (no pinta): se revisa a mano en claro y oscuro.
const revisar = async () => {
  const { violations } = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
};

// Datos inventados.
const EDUCANDOS = {
  curso: { id: "c1", nombre: "2026-27" },
  educandos: [
    { id: "e1", nombre: "Nora", apellidos: "Vidal Soler", seccionId: "s2", familia: { id: "f1", nombre: "Familia Vidal Soler" } },
    { id: "e2", nombre: "Bruno", apellidos: "Vidal Soler", seccionId: "s3", familia: { id: "f1", nombre: "Familia Vidal Soler" } },
  ],
};
const EVENTO = {
  id: "ev1",
  nombre: "Cuota 2026-27",
  tipo: "TODA_SECCION",
  fechaInicio: "2026-09-01",
  fechaFin: "2099-06-30",
  cerrado: false,
  descuentoHermanos: false,
  precioSegundoCentimos: null,
  precioTerceroCentimos: null,
  precios: [{ seccionId: "s2", importeCentimos: 11000 }],
};
const RESUMEN = { debidoCentimos: 11000, pagadoCentimos: 0, ninos: 1, alDia: 0 };
const CARGO = {
  id: "c1",
  educando: { id: "e1", nombre: "Nora", apellidos: "Vidal Soler" },
  seccionId: "s2",
  importeCentimos: 11000,
  importeCalculadoCentimos: 11000,
  ajustado: false,
  motivoAjuste: null,
  posicionHermano: 1,
  pagadoCentimos: 0,
  estado: "PENDIENTE",
};
const CAMISETA = {
  id: "a1",
  nombre: "Camiseta",
  precioCentimos: 1200,
  maxUnidades: 2,
  opciones: [
    { id: "o1", nombre: "Talla", tipo: "LISTA", obligatoria: true, maxLongitud: null, suplementoCentimos: 0, valores: [{ id: "v1", valor: "9/10", suplementoCentimos: 0 }] },
    { id: "o2", nombre: "Nombre al dorso", tipo: "TEXTO", obligatoria: false, maxLongitud: 12, suplementoCentimos: 300, valores: [] },
  ],
};
const LINEA = { articulo: "Camiseta", elecciones: [{ opcion: "Talla", tipo: "LISTA", valor: "9/10", suplementoCentimos: 0 }], importeCentimos: 1200 };
const PEDIDO = {
  pedido: {
    id: "p1",
    nombre: "Sudaderas 2026",
    fechaInicio: "2026-01-01",
    fechaFin: "2099-12-31",
    instruccionesPago: null,
    cerrado: false,
    formularioAbierto: true,
    enlace: `https://scouts.example.test/pedido#${"c".repeat(43)}`,
    pendientes: 1,
    articulos: [CAMISETA],
  },
  resumen: { debidoCentimos: 1200, pagadoCentimos: 0, personas: 1, unidades: 1 },
  personas: [{ cargoId: "c9", educando: EDUCANDOS.educandos[0], seccionId: "s2", importeCentimos: 1200, pagadoCentimos: 0, estado: "PENDIENTE", lineas: [{ ...LINEA, id: "l1" }] }],
  proveedor: { unidades: [{ articulo: "Camiseta", opciones: "Talla: 9/10", unidades: 1 }], textos: [] },
};
const ENVIO = {
  id: "en1",
  creadoEn: "2026-10-29T10:00:00.000Z",
  nombre: "Bruno",
  apellidos: "Vidal",
  seccionId: "s3",
  lineas: [LINEA],
  totalCentimos: 1200,
  semaforo: "DUDOSO",
  candidatos: [{ educandoId: "e2", nombre: "Bruno", apellidos: "Vidal Soler", seccionId: "s3" }],
  posibleCambio: true,
};
const MOVIMIENTO = {
  id: "m1",
  origen: "BANCO",
  fecha: "2026-10-01",
  concepto: "SOLER GIL ELENA",
  importeCentimos: 11000,
  estado: "DUDA",
  motivo: "NO_CUADRA",
  familia: null,
  cargos: [],
  clasificadoPor: null,
  clasificadoEn: null,
};
const CONTADORES = { dudas: 1, clasificados: 0, otros: 0 };
const PASO = {
  origen: { id: "c1", nombre: "2026-27" },
  destino: "2027-28",
  destinoExiste: false,
  secciones: SECCIONES,
  filas: [
    { educandoId: "e1", nombre: "Nora", apellidos: "Vidal Soler", seccionActualId: "s2", edad: 11, propuesta: { seccionId: "s3", motivo: "SUBE" } },
    { educandoId: "e2", nombre: "Bruno", apellidos: "Vidal Soler", seccionActualId: "s3", edad: null, propuesta: { seccionId: "s3", motivo: "SIN_FECHA" } },
  ],
};

const API = {
  "GET /auth/yo": { cuerpo: PERFIL_ADMIN },
  "GET /secciones": { cuerpo: { secciones: SECCIONES } },
  "GET /educandos": { cuerpo: EDUCANDOS },
  "GET /eventos": { cuerpo: { curso: EDUCANDOS.curso, eventos: [{ ...EVENTO, resumen: RESUMEN }] } },
  "GET /eventos/ev1": { cuerpo: { evento: EVENTO, resumen: RESUMEN, excluidos: 0, cargos: [CARGO] } },
  "GET /pedidos/p1": { cuerpo: PEDIDO },
  "GET /pedidos/p1/envios": { cuerpo: { envios: [ENVIO] } },
  "GET /movimientos?estado=DUDA": { cuerpo: { contadores: CONTADORES, movimientos: [MOVIMIENTO] } },
  "GET /usuarios": { cuerpo: { miembros: [], invitaciones: [] } },
  "GET /health": { cuerpo: { status: "ok", env: "test", db: "ok" } },
  "GET /cursos": { cuerpo: { cursos: [{ id: "c1", nombre: "2026-27", activo: true }], sugerido: "2026-27" } },
  "GET /cursos/paso": { cuerpo: PASO },
};

describe("accesibilidad (D-75)", () => {
  // axe intenta dibujar los iconos para comprobarlos; jsdom no tiene canvas y solo ensuciaria la salida.
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });

  it.each([
    ["Inicio", "/", "Hola, Ana"],
    ["Educandos", "/educandos", "Educandos"],
    ["Eventos", "/eventos", "Eventos"],
    ["Detalle de un evento", "/eventos/ev1", "Cuota 2026-27"],
    ["Nuevo evento", "/eventos/nuevo", "Nuevo evento"],
    ["Pedido", "/eventos/pedidos/p1", "Sudaderas 2026"],
    ["Nuevo pedido", "/eventos/pedidos/nuevo", "Nuevo pedido"],
    ["Movimientos", "/movimientos", "Movimientos"],
    ["Ajustes · Personas", "/ajustes/personas", "Ajustes"],
    ["Ajustes · Instalar", "/ajustes/instalar", "Instalar la app"],
    ["Ajustes · Curso", "/ajustes/curso", "Curso"],
    ["Paso de curso", "/ajustes/curso/paso", "Paso de 2026-27 a 2027-28"],
  ])("%s", async (_, ruta, titulo) => {
    simularApi(API);
    renderizar(ruta);
    await screen.findByRole("heading", { name: titulo });
    await revisar();
  });

  it("Entrar", async () => {
    simularApi({ "GET /auth/yo": { status: 401, cuerpo: { error: "Inicia sesión" } } });
    renderizar("/login");
    await screen.findByRole("button", { name: /Entrar/ });
    await revisar();
  });

  it("Formulario público de un pedido", async () => {
    window.history.replaceState(null, "", `/pedido#${"c".repeat(43)}`);
    simularApi({
      "GET /publico/pedido": {
        cuerpo: {
          grupo: "Grupo Scout Pinar",
          pedido: { nombre: "Sudaderas 2026", fechaFin: "2099-12-31", instruccionesPago: null },
          secciones: [{ id: "s2", nombre: "Manada" }],
          articulos: [CAMISETA],
          ticket: "1.x",
        },
      },
    });
    renderizar("/pedido");
    await screen.findByRole("heading", { name: "Sudaderas 2026" });
    await revisar();
    window.history.replaceState(null, "", "/");
  });
});
