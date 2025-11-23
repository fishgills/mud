/*
  Warnings:

  - You are about to drop the column `attack` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the `GuildHall` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlayerGuildState` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey (guarded so repeated deploys don't break)
ALTER TABLE IF EXISTS "public"."PlayerGuildState" DROP CONSTRAINT IF EXISTS "PlayerGuildState_playerId_fkey";

-- AlterTable: remove attack and add a dice-based damage column when needed
ALTER TABLE "public"."Item" DROP COLUMN IF EXISTS "attack";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Item'
          AND column_name = 'damageRoll'
    ) THEN
        ALTER TABLE "public"."Item"
            ADD COLUMN "damageRoll" TEXT NOT NULL DEFAULT '1d4';
    END IF;
END $$;

-- AlterTable: monsters gain a damage roll when the column is missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Monster'
          AND column_name = 'damageRoll'
    ) THEN
        ALTER TABLE "public"."Monster"
            ADD COLUMN "damageRoll" TEXT NOT NULL DEFAULT '1d6';
    END IF;
END $$;

-- DropTable (safe if the tables were already removed manually)
DROP TABLE IF EXISTS "public"."GuildHall";

-- DropTable
DROP TABLE IF EXISTS "public"."PlayerGuildState";
