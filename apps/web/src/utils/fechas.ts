const relativa = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

// "en 5 días", "mañana", "en 3 horas"...
export const tiempoHasta = (fecha: string | Date, ahora = new Date()) => {
  const ms = new Date(fecha).getTime() - ahora.getTime();
  const horas = Math.round(ms / 3_600_000);
  if (Math.abs(horas) < 24) return relativa.format(horas, "hour");
  return relativa.format(Math.round(horas / 24), "day");
};
