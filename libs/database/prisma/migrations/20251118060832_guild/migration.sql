-- DropForeignKey
ALTER TABLE "public"."PlayerGuildState" DROP CONSTRAINT "PlayerGuildState_playerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TransactionReceipt" DROP CONSTRAINT "TransactionReceipt_itemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TransactionReceipt" DROP CONSTRAINT "TransactionReceipt_playerId_fkey";

-- AlterTable
ALTER TABLE "public"."AnnouncementRecord" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."GuildHall" ALTER COLUMN "tileCoordinates" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."PlayerGuildState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."ShopCatalogItem" ALTER COLUMN "tags" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."PlayerGuildState" ADD CONSTRAINT "PlayerGuildState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransactionReceipt" ADD CONSTRAINT "TransactionReceipt_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransactionReceipt" ADD CONSTRAINT "TransactionReceipt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."ShopCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."AnnouncementRecord_status_visible_idx" RENAME TO "AnnouncementRecord_status_priority_visibleFrom_idx";
