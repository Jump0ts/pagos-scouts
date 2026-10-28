-- CreateEnum
CREATE TYPE "OrigenMovimiento" AS ENUM ('BANCO', 'LISTADO');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('CLASIFICADO', 'DUDA');

-- CreateEnum
CREATE TYPE "MotivoDuda" AS ENUM ('PAGADOR_DESCONOCIDO', 'FAMILIA_SIN_CONFIRMAR', 'NO_CUADRA', 'VARIAS_COMBINACIONES', 'POSIBLE_YA_MARCADO', 'DESHECHO');

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "origen" "OrigenMovimiento" NOT NULL,
    "numeroBanco" INTEGER,
    "fecha" DATE,
    "concepto" TEXT NOT NULL,
    "importeCentimos" INTEGER NOT NULL,
    "estado" "EstadoMovimiento" NOT NULL,
    "motivoDuda" "MotivoDuda",
    "familiaId" TEXT,
    "cargosSugeridos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clasificadoPorId" TEXT,
    "clasificadoEn" TIMESTAMP(3),
    "importadoPorId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asignacion" (
    "id" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "importeCentimos" INTEGER NOT NULL,

    CONSTRAINT "Asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagador" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Movimiento_grupoId_estado_idx" ON "Movimiento"("grupoId", "estado");

-- CreateIndex
CREATE INDEX "Movimiento_familiaId_idx" ON "Movimiento"("familiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_grupoId_numeroBanco_fecha_importeCentimos_key" ON "Movimiento"("grupoId", "numeroBanco", "fecha", "importeCentimos");

-- CreateIndex
CREATE INDEX "Asignacion_cargoId_idx" ON "Asignacion"("cargoId");

-- CreateIndex
CREATE UNIQUE INDEX "Asignacion_movimientoId_cargoId_key" ON "Asignacion"("movimientoId", "cargoId");

-- CreateIndex
CREATE INDEX "Pagador_familiaId_idx" ON "Pagador"("familiaId");

-- CreateIndex
CREATE UNIQUE INDEX "Pagador_grupoId_clave_key" ON "Pagador"("grupoId", "clave");

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_familiaId_fkey" FOREIGN KEY ("familiaId") REFERENCES "Familia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_clasificadoPorId_fkey" FOREIGN KEY ("clasificadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_importadoPorId_fkey" FOREIGN KEY ("importadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "Movimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asignacion" ADD CONSTRAINT "Asignacion_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagador" ADD CONSTRAINT "Pagador_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagador" ADD CONSTRAINT "Pagador_familiaId_fkey" FOREIGN KEY ("familiaId") REFERENCES "Familia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
