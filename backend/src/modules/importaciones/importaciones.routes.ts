import express, { Router } from "express";
import { requiereRol } from "../../middleware/auth.js";
import { prisma } from "../../prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { badRequest } from "../../utils/errors.js";
import { contiene, persona } from "../../utils/nombres.js";
import { validar } from "../../utils/validar.js";
import { obtenerOCrearCurso } from "../cursos/cursos.utils.js";
import { sincronizarCargos } from "../eventos/cargos.sincronizar.js";
import { comprobarSeccionesDelGrupo } from "../secciones/secciones.utils.js";
import { confirmarListadoSchema } from "./importaciones.schema.js";
import { analizarListado } from "./listado.analisis.js";
import { interpretarListado, leerFilas } from "./listado.parser.js";

// D-28: asistente de importacion del listado. Solo Admin y Tesoreria.
export const importacionesRouter = Router();
importacionesRouter.use(requiereRol("ADMIN", "TESORERIA"));

// Pasos 1 y 2: se sube el fichero tal cual (application/octet-stream) y se devuelve la propuesta, sin guardar nada.
// El fichero no se guarda en ningun sitio: se lee en memoria y se descarta.
importacionesRouter.post(
  "/listado/analizar",
  express.raw({ type: "application/octet-stream", limit: "5mb" }),
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw badRequest("Sube un fichero");
    const leido = interpretarListado(leerFilas(req.body));
    res.json(await analizarListado(req.grupo!.id, leido));
  }),
);

// Paso 3: se guarda la propuesta revisada, todo o nada.
importacionesRouter.post(
  "/listado/confirmar",
  asyncHandler(async (req, res) => {
    const datos = validar(confirmarListadoSchema, req.body);
    const grupoId = req.grupo!.id;

    const bloquesUsados = new Set(datos.familias.flatMap((f) => f.ninos.map((n) => String(n.bloque))));
    const sinSeccion = [...bloquesUsados].filter((b) => !datos.secciones[b]);
    if (sinSeccion.length) throw badRequest("Elige la sección de cada bloque", { secciones: "Falta la sección de algún bloque" });
    await comprobarSeccionesDelGrupo(grupoId, [...new Set(Object.values(datos.secciones))]);

    // Los "existentes" tienen que ser de este grupo: nunca se toca nada de otro.
    const idsFamilias = datos.familias.flatMap((f) => (f.existenteId ? [f.existenteId] : []));
    const idsNinos = datos.familias.flatMap((f) => f.ninos.flatMap((n) => (n.existenteId ? [n.existenteId] : [])));
    const [familiasOk, ninosOk] = await Promise.all([
      prisma.familia.count({ where: { grupoId, id: { in: idsFamilias } } }),
      prisma.educando.count({ where: { grupoId, id: { in: idsNinos } } }),
    ]);
    if (familiasOk !== new Set(idsFamilias).size || ninosOk !== new Set(idsNinos).size) {
      throw badRequest("La propuesta hace referencia a datos que no son de este grupo. Vuelve a subir el listado.");
    }

    const resumen = await prisma.$transaction(
      async (tx) => {
        const curso = await obtenerOCrearCurso(tx, grupoId, datos.curso);
        const cuenta = { familiasNuevas: 0, ninosNuevos: 0, ninosActualizados: 0 };

        for (const familia of datos.familias) {
          let familiaId = familia.existenteId;
          if (familiaId) {
            // Se añaden los responsables que no estaban (sin duplicar a quien ya esta escrito de otra forma).
            const actuales = await tx.responsable.findMany({ where: { familiaId }, orderBy: { orden: "asc" } });
            const nuevos = familia.responsables.filter(
              (r) => !actuales.some((a) => persona(a.nombreCompleto).palabras.every((t) => contiene(t, persona(r).palabras))),
            );
            await tx.responsable.createMany({
              data: nuevos.map((nombreCompleto, i) => ({ familiaId: familiaId!, nombreCompleto, orden: actuales.length + i })),
            });
          } else {
            const creada = await tx.familia.create({
              data: {
                grupoId,
                nombre: familia.nombre,
                responsables: { create: familia.responsables.map((nombreCompleto, orden) => ({ nombreCompleto, orden })) },
              },
            });
            familiaId = creada.id;
            cuenta.familiasNuevas += 1;
          }

          for (const nino of familia.ninos) {
            const seccionId = datos.secciones[String(nino.bloque)];
            if (nino.existenteId) {
              await tx.matricula.upsert({
                where: { educandoId_cursoId: { educandoId: nino.existenteId, cursoId: curso.id } },
                create: { educandoId: nino.existenteId, cursoId: curso.id, seccionId },
                update: { seccionId, bajaEn: null },
              });
              cuenta.ninosActualizados += 1;
            } else {
              await tx.educando.create({
                data: {
                  grupoId,
                  familiaId,
                  nombre: nino.nombre,
                  apellidos: nino.apellidos,
                  matriculas: { create: { cursoId: curso.id, seccionId } },
                },
              });
              cuenta.ninosNuevos += 1;
            }
          }
        }
        await sincronizarCargos(tx, grupoId);
        return { curso: { id: curso.id, nombre: curso.nombre }, ...cuenta };
      },
      { timeout: 30_000 },
    );
    res.status(201).json(resumen);
  }),
);
