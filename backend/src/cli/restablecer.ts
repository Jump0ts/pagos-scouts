// Enlace para restablecer la contrasena de cualquier usuario (D-21), para cuando no hay otro administrador que
// pueda generarlo desde la web. En el servidor:
//   docker compose ... exec api node dist/cli/restablecer.js --email persona@email
import { parseArgs } from "node:util";
import { emailSchema } from "../modules/auth/auth.schema.js";
import { crearRestablecimiento } from "../modules/restablecer/restablecer.utils.js";
import { prisma } from "../prisma.js";

const main = async () => {
  const { values } = parseArgs({ options: { email: { type: "string" } } });
  const email = emailSchema.safeParse(values.email);
  if (!email.success) {
    console.error("Uso: restablecer --email persona@email");
    process.exitCode = 1;
    return;
  }

  const usuario = await prisma.usuario.findUnique({ where: { email: email.data } });
  if (!usuario) {
    console.error(`No hay ningun usuario con el email ${email.data}`);
    process.exitCode = 1;
    return;
  }

  const { enlace, expiraEn } = await crearRestablecimiento(usuario.id);
  console.log(`Enlace para ${usuario.email} (caduca el ${expiraEn.toLocaleString("es-ES")}):`);
  console.log(enlace);
};

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
