import type { Evento, Prisma } from "@prisma/client";
import { env } from "../../env.js";
import { prisma } from "../../prisma.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import { pagadoPorCargo } from "../eventos/cargos.utils.js";
import type { ArticuloCatalogo, LineaPreparada } from "./pedidos.calculo.js";
import type { CatalogoEntrada } from "./pedidos.schema.js";

type Cliente = Prisma.TransactionClient;

export const hoy = (ahora = new Date()) => new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));

/** D-67: el formulario admite envios si el pedido no esta cerrado y hoy esta entre sus fechas. */
export const formularioAbierto = (evento: Pick<Evento, "cerradoEn" | "fechaInicio" | "fechaFin">, ahora = new Date()) =>
  evento.cerradoEn === null && evento.fechaInicio <= hoy(ahora) && evento.fechaFin >= hoy(ahora);

/** El codigo va detras del # (D-67): el navegador no lo manda al pedir la pagina. */
export const enlaceDe = (token: string) => `${env.PUBLIC_URL}/pedido#${token}`;

export const pedidoDelGrupo = async (id: string, grupoId: string) => {
  const evento = await prisma.evento.findFirst({ where: { id, grupoId, tipo: "PEDIDO" } });
  if (!evento) throw notFound("Pedido no encontrado");
  return evento;
};

export const noCerrado = (evento: Evento) => {
  if (evento.cerradoEn) throw conflict("El pedido está cerrado. Reábrelo para cambiar lo pedido.");
};

export const catalogoDe = async (eventoId: string, cliente: Cliente = prisma): Promise<ArticuloCatalogo[]> =>
  cliente.articulo.findMany({
    where: { eventoId },
    orderBy: { orden: "asc" },
    select: {
      id: true,
      nombre: true,
      precioCentimos: true,
      maxUnidades: true,
      opciones: {
        orderBy: { orden: "asc" },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          obligatoria: true,
          maxLongitud: true,
          suplementoCentimos: true,
          valores: { orderBy: { orden: "asc" }, select: { id: true, valor: true, suplementoCentimos: true } },
        },
      },
    },
  });

const datosOpcion = (o: CatalogoEntrada[number]["opciones"][number], orden: number) => ({
  nombre: o.nombre,
  tipo: o.tipo,
  obligatoria: o.obligatoria,
  maxLongitud: o.tipo === "TEXTO" ? o.maxLongitud : null,
  suplementoCentimos: o.tipo === "TEXTO" ? o.suplementoCentimos : 0,
  orden,
});

/**
 * Deja el catalogo como llega: lo que trae id se actualiza, lo nuevo se crea y lo que falta se quita. Un articulo
 * con unidades pedidas no se puede quitar; cambiar precios u opciones no toca lo ya pedido (se guardo tal cual).
 */
export const guardarCatalogo = async (tx: Cliente, eventoId: string, articulos: CatalogoEntrada) => {
  const actual = await catalogoDe(eventoId, tx);
  const ids = (lista: { id?: string }[]) => new Set(lista.flatMap((x) => (x.id ? [x.id] : [])));

  const quitados = actual.filter((a) => !ids(articulos).has(a.id));
  if (quitados.length) {
    const conLineas = await tx.lineaPedido.findFirst({ where: { articuloId: { in: quitados.map((a) => a.id) } }, include: { articulo: true } });
    if (conLineas) throw conflict(`«${conLineas.articulo.nombre}» ya tiene unidades pedidas: no se puede quitar del pedido`);
    await tx.articulo.deleteMany({ where: { id: { in: quitados.map((a) => a.id) } } });
  }

  for (const [i, a] of articulos.entries()) {
    const existente = a.id ? actual.find((x) => x.id === a.id) : undefined;
    if (a.id && !existente) throw badRequest("Revisa los datos enviados", { articulos: "Artículo no válido" });
    const datos = { nombre: a.nombre, precioCentimos: a.precioCentimos, maxUnidades: a.maxUnidades, orden: i };
    const articuloId = existente
      ? (await tx.articulo.update({ where: { id: existente.id }, data: datos })).id
      : (await tx.articulo.create({ data: { ...datos, eventoId } })).id;

    const opcionesActuales = existente?.opciones ?? [];
    const quedan = ids(a.opciones);
    await tx.opcionArticulo.deleteMany({ where: { articuloId, id: { notIn: [...quedan] } } });
    for (const [j, o] of a.opciones.entries()) {
      const opcionExistente = o.id ? opcionesActuales.find((x) => x.id === o.id) : undefined;
      if (o.id && !opcionExistente) throw badRequest("Revisa los datos enviados", { articulos: "Opción no válida" });
      const opcionId = opcionExistente
        ? (await tx.opcionArticulo.update({ where: { id: opcionExistente.id }, data: datosOpcion(o, j) })).id
        : (await tx.opcionArticulo.create({ data: { ...datosOpcion(o, j), articuloId } })).id;

      const valores = o.tipo === "LISTA" ? o.valores : [];
      await tx.valorOpcion.deleteMany({ where: { opcionId, id: { notIn: [...ids(valores)] } } });
      for (const [k, v] of valores.entries()) {
        const valorExistente = v.id ? opcionExistente?.valores.find((x) => x.id === v.id) : undefined;
        if (v.id && !valorExistente) throw badRequest("Revisa los datos enviados", { articulos: "Valor no válido" });
        const datosValor = { valor: v.valor, suplementoCentimos: v.suplementoCentimos, orden: k };
        if (valorExistente) await tx.valorOpcion.update({ where: { id: valorExistente.id }, data: datosValor });
        else await tx.valorOpcion.create({ data: { ...datosValor, opcionId } });
      }
    }
  }
};

/** El cargo de un educando en el pedido, creandolo o reactivandolo. Tiene que estar matriculado en el curso. */
export const cargoParaPedido = async (tx: Cliente, evento: Evento, educandoId: string) => {
  const matricula = await tx.matricula.findFirst({
    where: { educandoId, cursoId: evento.cursoId, bajaEn: null, educando: { grupoId: evento.grupoId } },
    select: { seccionId: true },
  });
  if (!matricula) throw badRequest("Esa persona no está en el listado de este curso", { educandoId: "Persona no válida" });
  return tx.cargo.upsert({
    where: { eventoId_educandoId: { eventoId: evento.id, educandoId } },
    create: { eventoId: evento.id, educandoId, seccionId: matricula.seccionId, importeCalculadoCentimos: 0 },
    update: { estado: "ACTIVO" },
  });
};

export const crearLineas = (tx: Cliente, cargoId: string, lineas: LineaPreparada[]) =>
  tx.lineaPedido.createMany({
    data: lineas.map((l) => ({ cargoId, articuloId: l.articuloId, importeCentimos: l.importeCentimos, elecciones: l.elecciones })),
  });

/**
 * El cargo de un pedido es la suma de sus lineas (D-66). Nunca puede quedar por debajo de lo ya pagado; sin lineas
 * ni pagos, la persona sale del pedido.
 */
export const recalcularCargo = async (tx: Cliente, cargoId: string) => {
  const suma = await tx.lineaPedido.aggregate({ where: { cargoId }, _sum: { importeCentimos: true }, _count: true });
  const total = suma._sum.importeCentimos ?? 0;
  const pagado = (await pagadoPorCargo([cargoId], tx)).get(cargoId) ?? 0;
  if (total < pagado) throw conflict("Ya ha pagado más de lo que quedaría pedido. Deshaz ese pago en Movimientos antes.");
  await tx.cargo.update({
    where: { id: cargoId },
    data: { importeCalculadoCentimos: total, estado: suma._count === 0 && pagado === 0 ? "EXCLUIDO" : "ACTIVO" },
  });
};

// D-70: los envios pendientes que nadie revise se borran 30 dias despues de cerrar o terminar el pedido.
export const DIAS_CONSERVACION = 30;

export const limpiarEnviosCaducados = async (ahora = new Date()) => {
  const limite = new Date(ahora.getTime() - DIAS_CONSERVACION * 24 * 60 * 60 * 1000);
  const { count } = await prisma.envioPedido.deleteMany({
    where: { evento: { OR: [{ cerradoEn: { lt: limite } }, { fechaFin: { lt: hoy(limite) } }] } },
  });
  return count;
};
