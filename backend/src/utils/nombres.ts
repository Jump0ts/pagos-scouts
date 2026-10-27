// Comparacion de nombres de personas, tal como la valido el prototipo (prototipo/conciliar.py): sin tildes ni
// mayusculas, apellidos compuestos como un solo token ("PEREZ DE ARCE"), diminutivos ("Pepa" = "Josefa") y una
// letra de diferencia permitida en palabras largas (erratas). La usan la importacion del listado y, mas adelante,
// el motor que reconoce quien paga en el Excel del banco.

const ENLACES = new Set(["DE", "DEL", "LA", "LAS", "LOS"]);

// Segundos nombres habituales: en "Juan Jose Rodriguez" JOSE es nombre, no apellido.
const SEGUNDOS_NOMBRES = new Set([
  "MARIA", "JOSE", "CARMEN", "ANGEL", "LUIS", "JESUS", "ISABEL", "TERESA", "DOLORES", "JOSEFA", "LUISA", "ANGELES",
  "MANUEL", "ANTONIO", "IGNACIO", "JAVIER", "CARLOS", "FRANCISCO", "ELENA", "CRISTINA", "VICTORIA", "EUGENIA",
]);

const DIMINUTIVOS: Record<string, string> = {
  MARI: "MARIA", PEPA: "JOSEFA", PEPE: "JOSE", PACO: "FRANCISCO", PACA: "FRANCISCA", LOLA: "DOLORES",
  NACHO: "IGNACIO", MANOLO: "MANUEL", MANOLI: "MANUELA", CHARO: "ROSARIO", CONCHA: "CONCEPCION",
  MERCHE: "MERCEDES", CHUS: "JESUS", NATI: "NATIVIDAD", INMA: "INMACULADA", RAFA: "RAFAEL",
};

/** "Mº Carmen Pérez" -> ["MARIA", "CARMEN", "PEREZ"] */
export const normalizar = (texto: string) =>
  texto
    .replace(/\bM\s*[ºª.]\s*/giu, "MARIA ")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z ]+/g, " ")
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);

/** Como normalizar, pero con los apellidos compuestos juntos y los diminutivos traducidos. */
export const tokens = (texto: string) => {
  const palabras = normalizar(texto);
  const resultado: string[] = [];
  let i = 0;
  while (i < palabras.length) {
    if (ENLACES.has(palabras[i])) {
      let j = i;
      while (j < palabras.length && ENLACES.has(palabras[j])) j++;
      if (resultado.length && j < palabras.length) {
        resultado[resultado.length - 1] = [resultado.at(-1), ...palabras.slice(i, j + 1)].join(" ");
        i = j + 1;
      } else {
        i = j; // enlace suelto al principio o al final: se ignora
      }
      continue;
    }
    resultado.push(DIMINUTIVOS[palabras[i]] ?? palabras[i]);
    i++;
  }
  return resultado;
};

const distancia = (a: string, b: string) => {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      actual.push(Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    previa = actual;
  }
  return previa[b.length];
};

/** Iguales, o con una sola letra de diferencia en palabras de 5 letras o mas (erratas). */
export const parecidos = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  return distancia(a, b) <= 1;
};

export const contiene = (token: string, lista: Iterable<string>) => {
  for (const otro of lista) if (parecidos(token, otro)) return true;
  return false;
};

export type Persona = { original: string; nombres: string[]; apellidos: string[]; palabras: string[] };

/** Interpreta "Nombre [Nombre2] Apellido1 [Apellido2]", el orden de los listados (no el del banco). */
export const persona = (texto: string): Persona => {
  const t = tokens(texto);
  const n = t.length >= 3 && SEGUNDOS_NOMBRES.has(t[1]) ? 2 : 1;
  const nombres = t.length >= 2 ? t.slice(0, n) : t;
  const apellidos = t.length >= 2 ? t.slice(n) : [];
  return { original: texto.trim(), nombres, apellidos, palabras: [...nombres, ...apellidos] };
};

/** "Mercedes Sánchez" y "Mercedes Sánchez González" pueden ser la misma persona. */
export const compatibles = (x: Persona, y: Persona) => {
  const [corta, larga] = x.palabras.length <= y.palabras.length ? [x.palabras, y.palabras] : [y.palabras, x.palabras];
  return corta.length > 0 && parecidos(corta[0], larga[0]) && corta.every((t) => contiene(t, larga));
};

/** Mismo niño con otra forma de escribirlo: mismas palabras, admitiendo erratas. */
export const mismoNombre = (a: string, b: string) => {
  const x = tokens(a);
  const y = tokens(b);
  return x.length === y.length && x.every((t, i) => parecidos(t, y[i]));
};

/**
 * Separa "Lucía Ruiz de la Torre Gil" en { nombre: "Lucía", apellidos: "Ruiz de la Torre Gil" } conservando
 * mayusculas y tildes. Los enlaces (de, del, la...) van con el apellido que les sigue.
 */
export const separarNombre = (completo: string) => {
  const palabras = completo.trim().split(/\s+/).filter(Boolean);
  if (palabras.length <= 1) return { nombre: palabras[0] ?? "", apellidos: "" };

  // Grupos: cada palabra, pero los enlaces se pegan a la siguiente ("de Perea").
  const grupos: string[] = [];
  let pendiente: string[] = [];
  for (const palabra of palabras) {
    if (ENLACES.has(normalizar(palabra)[0] ?? "")) {
      pendiente.push(palabra);
      continue;
    }
    grupos.push([...pendiente, palabra].join(" "));
    pendiente = [];
  }
  if (pendiente.length) grupos.push(pendiente.join(" "));

  const segundo = normalizar(grupos[1] ?? "")[0];
  const n = grupos.length >= 3 && segundo && SEGUNDOS_NOMBRES.has(segundo) ? 2 : 1;
  // Los apellidos son los dos ultimos grupos, contando "Ruiz de la Torre" como uno solo.
  const apellidos = grupos.slice(n);
  const compuestos: string[] = [];
  for (const g of apellidos) {
    if (/^(de|del|la|las|los)\s/i.test(g) && compuestos.length) compuestos[compuestos.length - 1] += ` ${g}`;
    else compuestos.push(g);
  }
  const nombre = [...grupos.slice(0, n), ...compuestos.slice(0, Math.max(0, compuestos.length - 2))].join(" ");
  return { nombre, apellidos: compuestos.slice(-2).join(" ") };
};
