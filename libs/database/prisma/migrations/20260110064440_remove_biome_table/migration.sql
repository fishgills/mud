/*
  Warnings:

  - You are about to drop the `Biome` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Monster" DROP CONSTRAINT "Monster_biomeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."WorldTile" DROP CONSTRAINT "WorldTile_biomeId_fkey";

-- DropTable
DROP TABLE "public"."Biome";
