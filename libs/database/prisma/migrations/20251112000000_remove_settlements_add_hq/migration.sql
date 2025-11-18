-- Remove settlement-related data structures in favor of the new HQ system
ALTER TABLE "public"."Npc" DROP CONSTRAINT IF EXISTS "Npc_settlementId_fkey";
ALTER TABLE "public"."Npc" DROP COLUMN IF EXISTS "settlementId";

DROP TABLE IF EXISTS "public"."Settlement";

ALTER TABLE "public"."Player"
  ADD COLUMN IF NOT EXISTS "isInHq" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastWorldX" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastWorldY" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastHqEnterAt" TIMESTAMP(3);

UPDATE "public"."Player"
SET "lastWorldX" = COALESCE("lastWorldX", "x"),
    "lastWorldY" = COALESCE("lastWorldY", "y")
WHERE "lastWorldX" IS DISTINCT FROM "x" OR "lastWorldY" IS DISTINCT FROM "y";
