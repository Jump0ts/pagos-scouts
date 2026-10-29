import { Router, type Request } from "express";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest, notFound, tooManyRequests } from "../../utils/errors.js";
import { validar } from "../../utils/validar.js";
import { LineaNoValida, prepararLineas, totalDe } from "./pedidos.calculo.js";
import { envioPublicoSchema } from "./pedidos.schema.js";
import { catalogoDe, formularioAbierto } from "./pedidos.utils.js";
import { comprobarTicket, emitirTicket, limiteEnvio, limiteLectura, MAX_PENDIENTES } from "./publico.proteccion.js";

// D-67: el formulario publico de un pedido. No hay sesion: lo unico que da acceso es el codigo del enlace, y solo
// para ver el catalogo y enviar. Nunca devuelve datos del listado del grupo.
export const publicoRouter = Router();

// El mismo mensaje para un codigo que no existe, uno antiguo o un pedido cerrado: no se da pista de cual es.
const NO_DISPONIBLE = "Este enlace no es válido o el pedido ya no admite encargos. Pide el enlace actual a tu grupo.";
const CODIGO = /^[A-Za-z0-9_-]{43}$/;

const pedidoAbierto = async (codigo: unknown) => {
  if (typeof codigo !== "string" || !CODIGO.test(codigo)) throw notFound(NO_DISPONIBLE);
  const evento = await prisma.evento.findUnique({ where: { enlacePedido: codigo }, include: { grupo: { select: { nombre: true } } } });
  if (!evento || evento.tipo !== "PEDIDO" || !formularioAbierto(evento)) throw notFound(NO_DISPONIBLE);
  return evento;
};

const ip = (req: Request) => req.ip ?? "desconocida";

// El codigo llega en una cabecera, no en la URL: asi tampoco queda en ningun registro de peticiones.
publicoRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    limiteLectura.comprobar(ip(req));
    const evento = await pedidoAbierto(req.get("x-enlace-pedido"));
    const [secciones, articulos] = await Promise.all([
      prisma.seccion.findMany({ where: { grupoId: evento.grupoId, archivada: false }, orderBy: { orden: "asc" }, select: { id: true, nombre: true } }),
      catalogoDe(evento.id),
    ]);
    res.json({
      grupo: evento.grupo.nombre,
      pedido: { nombre: evento.nombre, fechaFin: evento.fechaFin.toISOString().slice(0, 10), instruccionesPago: evento.instruccionesPago },
      secciones,
      articulos,
      ticket: emitirTicket(evento.id),
    });
  }),
);

publicoRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    // El limite va lo primero: cuenta tambien los envios que luego resultan no validos.
    limiteEnvio.comprobar(ip(req));
    const datos = validar(envioPublicoSchema, req.body);
    const evento = await pedidoAbierto(datos.enlace);

    const problema = comprobarTicket(datos.ticket, evento.id);
    if (problema === "DEMASIADO_RAPIDO") throw badRequest("Revisa el pedido un momento y vuelve a enviarlo.");
    if (problema) throw badRequest("El formulario ha caducado. Recarga la página y vuelve a rellenarlo.");

    const seccion = await prisma.seccion.findFirst({ where: { id: datos.seccionId, grupoId: evento.grupoId, archivada: false } });
    if (!seccion) throw badRequest("Revisa los datos enviados", { seccionId: "Elige una sección" });

    let lineas;
    try {
      lineas = prepararLineas(await catalogoDe(evento.id), datos.lineas);
    } catch (e) {
      if (e instanceof LineaNoValida) throw badRequest(e.message, { lineas: e.message });
      throw e;
    }
    const total = totalDe(lineas);
    const respuesta = {
      resumen: {
        nombre: `${datos.nombre} ${datos.apellidos}`,
        lineas: lineas.map((l) => ({ articulo: l.articulo, elecciones: l.elecciones, importeCentimos: l.importeCentimos })),
        totalCentimos: total,
      },
      instruccionesPago: evento.instruccionesPago,
    };

    // Campo trampa relleno: es un bot. Se le responde como si nada para que no aprenda, pero no se guarda.
    if (datos.web) {
      res.status(201).json(respuesta);
      return;
    }
    if ((await prisma.envioPedido.count({ where: { eventoId: evento.id } })) >= MAX_PENDIENTES) {
      throw tooManyRequests("Ahora mismo no se pueden recibir más encargos. Avisa a tu grupo.");
    }
    await prisma.envioPedido.create({
      data: {
        eventoId: evento.id,
        nombre: datos.nombre,
        apellidos: datos.apellidos,
        seccionId: seccion.id,
        lineas,
        totalCentimos: total,
      },
    });
    res.status(201).json(respuesta);
  }),
);
