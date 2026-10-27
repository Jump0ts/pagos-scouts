// Alta de un grupo y de su primer administrador (D-17). En el servidor:
//   docker compose ... exec api node dist/cli/crear-grupo.js --nombre "Grupo Scout ..." --admin persona@email
import { parseArgs } from "node:util";
import { z } from "zod";
import { emailSchema } from "../modules/auth/auth.schema.js";
import { crearGrupo } from "../modules/grupos/grupos.utils.js";
import { prisma } from "../prisma.js";

const main = async () => {
  const { values } = parseArgs({ options: { nombre: { type: "string" }, admin: { type: "string" } } });
  const datos = z
    .object({ nombre: z.string().trim().min(2, "--nombre es obligatorio"), admin: emailSchema })
    .safeParse(values);
  if (!datos.success) {
    console.error(`Uso: crear-grupo --nombre "Grupo Scout ..." --admin persona@email\n${datos.error.issues.map((i) => i.message).join("\n")}`);
    process.exitCode = 1;
    return;
  }

  const { grupo, enlace, expiraEn } = await crearGrupo(datos.data.nombre, datos.data.admin);
  console.log(`Grupo creado: ${grupo.nombre}`);
  console.log(`Invitacion para ${datos.data.admin} (caduca el ${expiraEn.toLocaleString("es-ES")}):`);
  console.log(enlace);
};

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
