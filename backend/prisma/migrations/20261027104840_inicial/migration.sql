-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'TESORERIA', 'SCOUTER');

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seccion" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hashContrasena" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membresia" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membresia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembresiaSeccion" (
    "membresiaId" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,

    CONSTRAINT "MembresiaSeccion_pkey" PRIMARY KEY ("membresiaId","seccionId")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "hashToken" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "grupoActivoId" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitacion" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "hashToken" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadaPorId" TEXT,

    CONSTRAINT "Invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitacionSeccion" (
    "invitacionId" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,

    CONSTRAINT "InvitacionSeccion_pkey" PRIMARY KEY ("invitacionId","seccionId")
);

-- CreateTable
CREATE TABLE "Restablecimiento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "hashToken" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Restablecimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Seccion_grupoId_idx" ON "Seccion"("grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "Seccion_grupoId_nombre_key" ON "Seccion"("grupoId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Membresia_grupoId_idx" ON "Membresia"("grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "Membresia_usuarioId_grupoId_key" ON "Membresia"("usuarioId", "grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_hashToken_key" ON "Sesion"("hashToken");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitacion_hashToken_key" ON "Invitacion"("hashToken");

-- CreateIndex
CREATE INDEX "Invitacion_grupoId_idx" ON "Invitacion"("grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "Restablecimiento_hashToken_key" ON "Restablecimiento"("hashToken");

-- CreateIndex
CREATE INDEX "Restablecimiento_usuarioId_idx" ON "Restablecimiento"("usuarioId");

-- AddForeignKey
ALTER TABLE "Seccion" ADD CONSTRAINT "Seccion_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membresia" ADD CONSTRAINT "Membresia_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembresiaSeccion" ADD CONSTRAINT "MembresiaSeccion_membresiaId_fkey" FOREIGN KEY ("membresiaId") REFERENCES "Membresia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembresiaSeccion" ADD CONSTRAINT "MembresiaSeccion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitacion" ADD CONSTRAINT "Invitacion_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitacion" ADD CONSTRAINT "Invitacion_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitacionSeccion" ADD CONSTRAINT "InvitacionSeccion_invitacionId_fkey" FOREIGN KEY ("invitacionId") REFERENCES "Invitacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitacionSeccion" ADD CONSTRAINT "InvitacionSeccion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restablecimiento" ADD CONSTRAINT "Restablecimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
