export type EducandoDeLista = {
  id: string;
  nombre: string;
  apellidos: string;
  seccionId: string;
  // No llega a los scouters (D-32).
  familia?: { id: string; nombre: string };
};

export type ListaEducandos = {
  curso: { id: string; nombre: string } | null;
  educandos: EducandoDeLista[];
};

export type HijoEnFicha = {
  id: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: string | null;
  seccionId: string | null;
  deBaja: boolean;
};

export type FichaFamilia = {
  id: string;
  nombre: string;
  responsables: { id: string; nombreCompleto: string }[];
  educandos: HijoEnFicha[];
};

// A que familia va un niño al darlo de alta o moverlo.
export type DestinoFamilia = { id: string } | { nueva: { responsables: string[] } };
