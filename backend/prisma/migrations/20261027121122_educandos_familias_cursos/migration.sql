-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Familia" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Familia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Responsable" (
    "id" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Responsable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Educando" (
    "id" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL DEFAULT '',
    "fechaNacimiento" DATE,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Educando_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matricula" (
    "id" TEXT NOT NULL,
    "educandoId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "seccionId" TEXT NOT NULL,
    "bajaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Matricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Curso_grupoId_idx" ON "Curso"("grupoId");

-- CreateIndex
CREATE UNIQUE INDEX "Curso_grupoId_nombre_key" ON "Curso"("grupoId", "nombre");

-- CreateIndex
CREATE INDEX "Familia_grupoId_idx" ON "Familia"("grupoId");

-- CreateIndex
CREATE INDEX "Responsable_familiaId_idx" ON "Responsable"("familiaId");

-- CreateIndex
CREATE INDEX "Educando_grupoId_idx" ON "Educando"("grupoId");

-- CreateIndex
CREATE INDEX "Educando_familiaId_idx" ON "Educando"("familiaId");

-- CreateIndex
CREATE INDEX "Matricula_cursoId_idx" ON "Matricula"("cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "Matricula_educandoId_cursoId_key" ON "Matricula"("educandoId", "cursoId");

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Familia" ADD CONSTRAINT "Familia_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Responsable" ADD CONSTRAINT "Responsable_familiaId_fkey" FOREIGN KEY ("familiaId") REFERENCES "Familia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Educando" ADD CONSTRAINT "Educando_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Educando" ADD CONSTRAINT "Educando_familiaId_fkey" FOREIGN KEY ("familiaId") REFERENCES "Familia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_educandoId_fkey" FOREIGN KEY ("educandoId") REFERENCES "Educando"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
