import { prisma } from "../../prisma.js";
import { compatibles, contiene, mismoNombre, normalizar, persona, separarNombre, tokens, type Persona } from "../../utils/nombres.js";
import { cursoActivo, nombreCursoPara } from "../cursos/cursos.utils.js";
import { nombreFamiliaPara } from "../familias/familias.utils.js";
import type { AnalisisListado, FamiliaPropuesta } from "./importaciones.types.js";
import type { ListadoLeido } from "./listado.parser.js";

type Grupo = {
  responsables: Persona[];
  textos: string[];
  apellidosHijos: Set<string>;
  ninos: { fila: number; bloque: number; nino: string }[];
  avisos: string[];
};

const textoIgual = (a: string, b: string) => normalizar(a).join(" ") === normalizar(b).join(" ");

// Mismos responsables (admitiendo erratas o apellidos de menos) y hermanos que comparten apellido, como en el
// prototipo. Los niños sin responsables nunca se unen a nadie.
const esMismaFamilia = (grupo: Grupo, responsables: Persona[], apellidosNino: string[]) => {
  if (!grupo.responsables.length || !responsables.length) return false;
  const [pocos, muchos] =
    grupo.responsables.length <= responsables.length ? [grupo.responsables, responsables] : [responsables, grupo.responsables];
  if (!pocos.every((p) => muchos.some((q) => compatibles(p, q)))) return false;
  return apellidosNino.some((a) => contiene(a, grupo.apellidosHijos));
};

export const analizarListado = async (grupoId: string, leido: ListadoLeido): Promise<AnalisisListado> => {
  // 1) Agrupar en familias.
  const grupos: Grupo[] = [];
  for (const fila of leido.filas) {
    const responsables = fila.responsables.map(persona);
    const apellidosNino = persona(fila.nino).apellidos;
    let grupo = grupos.find((g) => esMismaFamilia(g, responsables, apellidosNino));
    if (!grupo) {
      grupo = { responsables, textos: fila.responsables, apellidosHijos: new Set(), ninos: [], avisos: [] };
      grupos.push(grupo);
    } else {
      const distintos = fila.responsables.join(" / ");
      if (!textoIgual(grupo.textos.join(" / "), distintos)) {
        grupo.avisos.push(`Unida porque "${distintos}" parece la misma familia que "${grupo.textos.join(" / ")}"`);
      }
      // Nos quedamos con la version mas completa de los nombres.
      const palabras = (ps: Persona[]) => ps.reduce((n, p) => n + p.palabras.length, 0);
      if (palabras(responsables) > palabras(grupo.responsables)) {
        grupo.responsables = responsables;
        grupo.textos = fila.responsables;
      }
    }
    if (grupo.ninos.some((n) => mismoNombre(n.nino, fila.nino))) {
      grupo.avisos.push(`"${fila.nino}" aparece dos veces (fila ${fila.fila}); se importa una sola vez`);
      continue;
    }
    apellidosNino.forEach((a) => grupo.apellidosHijos.add(a));
    grupo.ninos.push(fila);
  }

  // 2) Lo que ya existe en el grupo (reimportacion, D-29).
  const curso = await cursoActivo(grupoId);
  const existentes = await prisma.educando.findMany({
    where: { grupoId },
    select: {
      id: true,
      nombre: true,
      apellidos: true,
      familiaId: true,
      matriculas: { where: { cursoId: curso?.id ?? "" }, select: { seccionId: true, bajaEn: true } },
    },
  });
  const familiasExistentes = await prisma.familia.findMany({
    where: { grupoId },
    select: { id: true, responsables: { select: { nombreCompleto: true } }, educandos: { select: { apellidos: true } } },
  });
  const reconocidos = new Set<string>();

  const familias: FamiliaPropuesta[] = grupos.map((g, i) => {
    const ninos = g.ninos.map((n) => {
      const existente = existentes.find((e) => !reconocidos.has(e.id) && mismoNombre(`${e.nombre} ${e.apellidos}`, n.nino));
      if (existente) reconocidos.add(existente.id);
      return {
        clave: `f${n.fila}`,
        bloque: n.bloque,
        ...separarNombre(n.nino),
        existenteId: existente?.id ?? null,
        seccionActualId: existente?.matriculas[0]?.seccionId ?? null,
        familiaExistenteId: existente?.familiaId ?? null,
      };
    });

    // La familia ya existe si alguno de sus niños existe, o si coinciden responsables y apellidos de los hijos.
    let existenteId = ninos.find((n) => n.familiaExistenteId)?.familiaExistenteId ?? null;
    if (!existenteId && g.responsables.length) {
      existenteId =
        familiasExistentes.find((f) => {
          const suyos = f.responsables.map((r) => persona(r.nombreCompleto));
          const apellidos = new Set(f.educandos.flatMap((e) => tokens(e.apellidos)));
          return (
            suyos.length > 0 &&
            g.responsables.every((p) => suyos.some((q) => compatibles(p, q))) &&
            [...g.apellidosHijos].some((a) => contiene(a, apellidos))
          );
        })?.id ?? null;
    }

    const avisos = [...g.avisos];
    if (!g.responsables.length) avisos.push("Sin responsables: sus pagos no se podrán reconocer por el nombre de quien paga");
    const primero = ninos[0];
    return {
      clave: `familia-${i + 1}`,
      nombre: nombreFamiliaPara(primero.apellidos, g.textos, primero.nombre),
      responsables: g.textos,
      existenteId,
      ninos: ninos.map(({ familiaExistenteId: _, ...n }) => n),
      avisos,
    };
  });

  // 3) Resumen de bloques y posibles bajas.
  const bloques = Array.from({ length: leido.bloques }, (_, indice) => {
    const del = leido.filas.filter((f) => f.bloque === indice);
    return { indice, total: del.length, ejemplos: del.slice(0, 3).map((f) => f.nino) };
  }).filter((b) => b.total > 0);

  const noAparecen = existentes
    .filter((e) => !reconocidos.has(e.id) && e.matriculas[0] && !e.matriculas[0].bajaEn)
    .map((e) => ({ id: e.id, nombre: `${e.nombre} ${e.apellidos}`.trim(), seccionId: e.matriculas[0].seccionId }));

  return {
    bloques,
    familias,
    columnasIgnoradas: leido.columnasIgnoradas,
    noAparecen,
    cursoSugerido: curso?.nombre ?? nombreCursoPara(),
  };
};
