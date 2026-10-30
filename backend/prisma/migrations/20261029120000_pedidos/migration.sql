-- CreateEnum
CREATE TYPE "TipoOpcion" AS ENUM ('LISTA', 'TEXTO');

-- AlterEnum
ALTER TYPE "TipoEvento" ADD VALUE 'PEDIDO';

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "cerradoEn" TIMESTAMP(3),
ADD COLUMN     "enlacePedido" TEXT,
ADD COLUMN     "instruccionesPago" TEXT;

-- CreateTable
CREATE TABLE "Articulo" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioCentimos" INTEGER NOT NULL,
    "maxUnidades" INTEGER NOT NULL DEFAULT 5,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "Articulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpcionArticulo" (
    "id" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoOpcion" NOT NULL,
    "obligatoria" BOOLEAN NOT NULL DEFAULT true,
    "maxLongitud" INTEGER,
    "suplementoCentimos" INTEGER NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "OpcionArticulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorOpcion" (
    "id" TEXT NOT NULL,
    "opcionId" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "suplementoCentimos" INTEGER NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "ValorOpcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaPedido" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "articuloId" TEXT NOT NULL,
    "importeCentimos" INTEGER NOT NULL,
    "elecciones" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineaPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvioPedido" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "lineas" JSONB NOT NULL,
    "totalCentimos" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioPedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Articulo_eventoId_idx" ON "Articulo"("eventoId");

-- CreateIndex
CREATE INDEX "OpcionArticulo_articuloId_idx" ON "OpcionArticulo"("articuloId");

-- CreateIndex
CREATE INDEX "ValorOpcion_opcionId_idx" ON "ValorOpcion"("opcionId");

-- CreateIndex
CREATE INDEX "LineaPedido_cargoId_idx" ON "LineaPedido"("cargoId");

-- CreateIndex
CREATE INDEX "LineaPedido_articuloId_idx" ON "LineaPedido"("articuloId");

-- CreateIndex
CREATE INDEX "EnvioPedido_eventoId_idx" ON "EnvioPedido"("eventoId");

-- CreateIndex
CREATE UNIQUE INDEX "Evento_enlacePedido_key" ON "Evento"("enlacePedido");

-- AddForeignKey
ALTER TABLE "Articulo" ADD CONSTRAINT "Articulo_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpcionArticulo" ADD CONSTRAINT "OpcionArticulo_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorOpcion" ADD CONSTRAINT "ValorOpcion_opcionId_fkey" FOREIGN KEY ("opcionId") REFERENCES "OpcionArticulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPedido" ADD CONSTRAINT "LineaPedido_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPedido" ADD CONSTRAINT "LineaPedido_articuloId_fkey" FOREIGN KEY ("articuloId") REFERENCES "Articulo"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioPedido" ADD CONSTRAINT "EnvioPedido_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

