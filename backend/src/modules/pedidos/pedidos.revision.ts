// D-68: a quien corresponde lo que llega por el formulario publico. Puro: recibe los educandos del curso y devuelve
// el semaforo y los candidatos; quien acepta siempre es Tesoreria.
import { compatibles, mismoNombre, parecidos, persona } from "../../utils/nombres.js";

export type Candidato = { educandoId: string; nombre: string; apellidos: string; seccionId: string };
export type Semaforo = "RECONOCIDO" | "DUDOSO" | "SIN_COINCIDENCIA";

const MAX_CANDIDATOS = 5;

export const buscarPersona = (envio: { nombre: string; apellidos: string; seccionId: string }, educandos: Candidato[]) => {
  const completo = `${envio.nombre} ${envio.apellidos}`;
  const buscada = persona(completo);
  const exactos = educandos.filter((e) => mismoNombre(`${e.nombre} ${e.apellidos}`, completo));
  const parecidosA = educandos.filter((e) => !exactos.includes(e) && compatibles(buscada, persona(`${e.nombre} ${e.apellidos}`)));
  const enSuSeccion = (lista: Candidato[]) => lista.filter((e) => e.seccionId === envio.seccionId);
  const primeroSuSeccion = (lista: Candidato[]) =>
    [...enSuSeccion(lista), ...lista.filter((e) => e.seccionId !== envio.seccionId)].slice(0, MAX_CANDIDATOS);

  // Reconocido: un unico candidato claro y en la seccion que ha dicho la familia.
  if (exactos.length === 1 && exactos[0].seccionId === envio.seccionId) {
    return { semaforo: "RECONOCIDO" as Semaforo, candidatos: exactos };
  }
  if (!exactos.length && parecidosA.length === 1 && parecidosA[0].seccionId === envio.seccionId) {
    return { semaforo: "RECONOCIDO" as Semaforo, candidatos: parecidosA };
  }
  if (exactos.length || parecidosA.length) {
    return { semaforo: "DUDOSO" as Semaforo, candidatos: primeroSuSeccion([...exactos, ...parecidosA]) };
  }
  // Sin coincidencia: como ayuda, los de su seccion con un nombre de pila parecido.
  const pila = buscada.nombres[0];
  const mismaPila = pila
    ? enSuSeccion(educandos).filter((e) => persona(`${e.nombre} ${e.apellidos}`).nombres.some((n) => parecidos(n, pila)))
    : [];
  return { semaforo: "SIN_COINCIDENCIA" as Semaforo, candidatos: mismaPila.slice(0, MAX_CANDIDATOS) };
};
