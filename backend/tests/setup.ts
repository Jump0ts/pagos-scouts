import { reiniciarIntentos } from "../src/modules/auth/intentos.js";
import { reiniciarLimites } from "../src/utils/limite.js";
import { prisma } from "../src/prisma.js";

// Barrera de seguridad: los tests vacian la base de datos en cada prueba, asi que solo pueden correr contra una
// base cuyo nombre diga que es de pruebas.
const nombreBase = new URL(process.env.DATABASE_URL ?? "postgresql://x@x/sin-configurar").pathname.slice(1);
if (!/test/i.test(nombreBase)) {
  throw new Error(
    `Los tests necesitan TEST_DATABASE_URL apuntando a una base de pruebas (con "test" en el nombre); ahora seria "${nombreBase}".`,
  );
}

const TABLAS = [
  "EnvioPedido",
  "LineaPedido",
  "ValorOpcion",
  "OpcionArticulo",
  "Articulo",
  "Asignacion",
  "Movimiento",
  "Pagador",
  "Cargo",
  "PrecioSeccion",
  "Evento",
  "Matricula",
  "Educando",
  "Responsable",
  "Familia",
  "Curso",
  "Restablecimiento",
  "InvitacionSeccion",
  "Invitacion",
  "MembresiaSeccion",
  "Membresia",
  "Sesion",
  "Seccion",
  "Usuario",
  "Grupo",
];

beforeEach(async () => {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLAS.map((t) => `"${t}"`).join(", ")} CASCADE`);
  reiniciarIntentos();
  reiniciarLimites();
});

afterAll(async () => {
  await prisma.$disconnect();
});
