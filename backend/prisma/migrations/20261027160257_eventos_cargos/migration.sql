-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('TODA_SECCION', 'CON_APUNTADOS');

-- CreateEnum
CREATE TYPE "EstadoCargo" AS ENUM ('ACTIVO', 'EXCLUIDO', 'ANULADO');

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "descuentoHermanos" BOOLEAN NOT NULL DEFAULT false,
    "precioSegundoCentimos" INTEGER,
    "precioTerceroCentimos" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecioSeccion" (
    "eventoId" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "importeCentimos" INTEGER NOT NULL,

    CONSTRAINT "PrecioSeccion_pkey" PRIMARY KEY ("eventoId","seccionId")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "educandoId" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "estado" "EstadoCargo" NOT NULL DEFAULT 'ACTIVO',
    "importeCalculadoCentimos" INTEGER NOT NULL,
    "importeAjustadoCentimos" INTEGER,
    "motivoAjuste" TEXT,
    "posicionHermano" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evento_grupoId_cursoId_idx" ON "Evento"("grupoId", "cursoId");

-- CreateIndex
CREATE INDEX "Cargo_educandoId_idx" ON "Cargo"("educandoId");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_eventoId_educandoId_key" ON "Cargo"("eventoId", "educandoId");

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioSeccion" ADD CONSTRAINT "PrecioSeccion_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecioSeccion" ADD CONSTRAINT "PrecioSeccion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_educandoId_fkey" FOREIGN KEY ("educandoId") REFERENCES "Educando"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
