import { prisma } from "../../prisma.js";
import { crearInvitacion } from "../invitaciones/invitaciones.utils.js";
import { crearSeccionesPorDefecto } from "../secciones/secciones.utils.js";

// D-17: alta de un grupo (solo desde el comando del servidor). Crea el grupo con sus secciones por defecto y la
// invitacion de su primer administrador.
export const crearGrupo = async (nombre: string, emailAdmin: string) => {
  const grupo = await prisma.$transaction(async (tx) => {
    const creado = await tx.grupo.create({ data: { nombre } });
    await crearSeccionesPorDefecto(tx, creado.id);
    return creado;
  });
  const { enlace, invitacion } = await crearInvitacion({
    grupoId: grupo.id,
    email: emailAdmin,
    rol: "ADMIN",
    seccionIds: [],
    creadaPorId: null,
  });
  return { grupo, enlace, expiraEn: invitacion.expiraEn };
};
