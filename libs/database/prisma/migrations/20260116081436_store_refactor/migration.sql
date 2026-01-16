-- CreateEnum
CREATE TYPE "public"."TicketTier" AS ENUM ('Rare', 'Epic', 'Legendary');

-- AlterTable
ALTER TABLE "public"."Item" ADD COLUMN     "agilityBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "healthBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itemPower" INTEGER,
ADD COLUMN     "strengthBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier" INTEGER,
ADD COLUMN     "weaponDiceCount" INTEGER,
ADD COLUMN     "weaponDiceSides" INTEGER;

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "epicTickets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "legendaryTickets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rareTickets" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."ShopCatalogItem" ADD COLUMN     "agilityBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "archetype" TEXT,
ADD COLUMN     "healthBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itemPower" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "offsetK" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refreshId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "strengthBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ticketRequirement" "public"."TicketTier",
ADD COLUMN     "tier" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "weaponDiceCount" INTEGER,
ADD COLUMN     "weaponDiceSides" INTEGER;

-- CreateTable
CREATE TABLE "public"."GuildShopState" (
    "id" SERIAL NOT NULL,
    "refreshId" TEXT NOT NULL,
    "refreshesSinceChase" INTEGER NOT NULL DEFAULT 0,
    "globalTier" INTEGER NOT NULL DEFAULT 1,
    "medianLevel" INTEGER NOT NULL DEFAULT 1,
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildShopState_pkey" PRIMARY KEY ("id")
);
