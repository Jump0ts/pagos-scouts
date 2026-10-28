// Calculo puro de lo que debe cada niño en un evento (D-34). Sin base de datos: se prueba aparte.

export type NinoConCargo = {
  cargoId: string;
  familiaId: string;
  seccionId: string;
  ordenSeccion: number;
  fechaNacimiento: Date | null;
  nombre: string;
};

export type ConfigPrecios = {
  preciosPorSeccion: Map<string, number>;
  descuentoHermanos: boolean;
  precioSegundoCentimos: number | null;
  precioTerceroCentimos: number | null;
};

export type ResultadoCargo = { posicion: number; importeCentimos: number };

// El mayor primero: por fecha de nacimiento si ambos la tienen; si no, el de la seccion de mas edad.
const mayorPrimero = (a: NinoConCargo, b: NinoConCargo) => {
  if (a.fechaNacimiento && b.fechaNacimiento && a.fechaNacimiento.getTime() !== b.fechaNacimiento.getTime()) {
    return a.fechaNacimiento.getTime() - b.fechaNacimiento.getTime();
  }
  if (a.ordenSeccion !== b.ordenSeccion) return b.ordenSeccion - a.ordenSeccion;
  return a.nombre.localeCompare(b.nombre, "es");
};

export const calcularCargos = (ninos: NinoConCargo[], config: ConfigPrecios) => {
  const resultado = new Map<string, ResultadoCargo>();
  const porFamilia = new Map<string, NinoConCargo[]>();
  for (const n of ninos) porFamilia.set(n.familiaId, [...(porFamilia.get(n.familiaId) ?? []), n]);

  for (const hermanos of porFamilia.values()) {
    hermanos.sort(mayorPrimero).forEach((n, i) => {
      const posicion = i + 1;
      const base = config.preciosPorSeccion.get(n.seccionId) ?? 0;
      let importe = base;
      if (config.descuentoHermanos && posicion >= 2 && config.precioSegundoCentimos !== null) {
        const fijo = posicion === 2 ? config.precioSegundoCentimos : (config.precioTerceroCentimos ?? config.precioSegundoCentimos);
        // Nunca mas que el precio de su seccion.
        importe = Math.min(base, fijo);
      }
      resultado.set(n.cargoId, { posicion, importeCentimos: importe });
    });
  }
  return resultado;
};
