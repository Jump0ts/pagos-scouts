-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'OTRO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoMovimiento" ADD VALUE 'OTRO_INGRESO';
ALTER TYPE "EstadoMovimiento" ADD VALUE 'CRUZADO';

-- AlterEnum
ALTER TYPE "MotivoDuda" ADD VALUE 'POSIBLE_YA_APUNTADO';

-- AlterEnum
ALTER TYPE "OrigenMovimiento" ADD VALUE 'MANUAL';

-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN     "cruzadoConId" TEXT,
ADD COLUMN     "medio" "MedioPago",
ADD COLUMN     "nota" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_cruzadoConId_key" ON "Movimiento"("cruzadoConId");

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_cruzadoConId_fkey" FOREIGN KEY ("cruzadoConId") REFERENCES "Movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

