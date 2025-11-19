-- Guild tables to power teleportation, shop commerce, and announcements
CREATE TYPE "public"."GuildTradeDirection" AS ENUM ('BUY', 'SELL');
CREATE TYPE "public"."AnnouncementStatus" AS ENUM ('PENDING', 'ANNOUNCED', 'EXPIRED');

CREATE TABLE IF NOT EXISTS "public"."GuildHall" (
  "id" SERIAL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "tileCoordinates" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "populationLimit" INTEGER NOT NULL DEFAULT 50,
  "services" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "teleportCooldownSeconds" INTEGER NOT NULL DEFAULT 300,
  "arrivalMessage" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."PlayerGuildState" (
  "playerId" INTEGER PRIMARY KEY REFERENCES "public"."Player"("id") ON DELETE CASCADE,
  "lastTeleportAt" TIMESTAMP(3),
  "cooldownExpiresAt" TIMESTAMP(3),
  "lastGuildLocation" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."ShopCatalogItem" (
  "id" SERIAL PRIMARY KEY,
  "sku" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT NOT NULL DEFAULT '',
  "buyPriceGold" INTEGER NOT NULL,
  "sellPriceGold" INTEGER NOT NULL,
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "maxStock" INTEGER,
  "restockIntervalMinutes" INTEGER,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "public"."TransactionReceipt" (
  "id" SERIAL PRIMARY KEY,
  "playerId" INTEGER NOT NULL REFERENCES "public"."Player"("id") ON DELETE CASCADE,
  "itemId" INTEGER REFERENCES "public"."ShopCatalogItem"("id") ON DELETE SET NULL,
  "direction" "public"."GuildTradeDirection" NOT NULL,
  "goldDelta" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "correlationId" TEXT,
  "eventBusMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "TransactionReceipt_playerId_createdAt_idx"
  ON "public"."TransactionReceipt" ("playerId", "createdAt");

CREATE TABLE IF NOT EXISTS "public"."AnnouncementRecord" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "visibleFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "visibleUntil" TIMESTAMP(3),
  "lastAnnouncedAt" TIMESTAMP(3),
  "status" "public"."AnnouncementStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AnnouncementRecord_status_visible_idx"
  ON "public"."AnnouncementRecord" ("status", "priority", "visibleFrom");
