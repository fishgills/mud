/*
  Warnings:

  - Changed the type of `type` on the `Item` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."ItemType" AS ENUM ('WEAPON', 'ARMOR');

-- AlterTable
-- Delete invalid items and their references
DELETE FROM "public"."PlayerItem" WHERE "itemId" IN (SELECT "id" FROM "public"."Item" WHERE "type" NOT IN ('weapon', 'armor'));
DELETE FROM "public"."WorldItem" WHERE "itemId" IN (SELECT "id" FROM "public"."Item" WHERE "type" NOT IN ('weapon', 'armor'));
DELETE FROM "public"."ShopCatalogItem" WHERE "itemTemplateId" IN (SELECT "id" FROM "public"."Item" WHERE "type" NOT IN ('weapon', 'armor'));
DELETE FROM "public"."Item" WHERE "type" NOT IN ('weapon', 'armor');

-- AlterTable
ALTER TABLE "public"."Item" ALTER COLUMN "type" TYPE "public"."ItemType" USING upper("type")::"public"."ItemType";
