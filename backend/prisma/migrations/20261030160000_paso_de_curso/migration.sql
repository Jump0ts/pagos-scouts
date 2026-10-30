-- AlterTable
ALTER TABLE "Seccion" ADD COLUMN "edadMaxima" INTEGER;

-- D-79: las secciones por defecto que conservan su nombre reciben su edad maxima.
UPDATE "Seccion" SET "edadMaxima" = 7 WHERE "nombre" = 'Castores';
UPDATE "Seccion" SET "edadMaxima" = 10 WHERE "nombre" = 'Manada';
UPDATE "Seccion" SET "edadMaxima" = 13 WHERE "nombre" = 'Tropa';
UPDATE "Seccion" SET "edadMaxima" = 16 WHERE "nombre" = 'Unidad';
UPDATE "Seccion" SET "edadMaxima" = 21 WHERE "nombre" = 'Clan';
