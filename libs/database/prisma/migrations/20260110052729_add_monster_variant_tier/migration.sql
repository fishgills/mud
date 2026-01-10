-- AlterTable
ALTER TABLE "public"."Monster" ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "variant" TEXT NOT NULL DEFAULT 'normal';
