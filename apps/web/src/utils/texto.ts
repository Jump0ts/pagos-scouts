// Para buscar sin que importen tildes ni mayusculas.
export const plano = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
