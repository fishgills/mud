-- Add equipment slot columns to Player
ALTER TABLE "public"."Player"
  ADD COLUMN "headItemId" INTEGER,
  ADD COLUMN "chestItemId" INTEGER,
  ADD COLUMN "legsItemId" INTEGER,
  ADD COLUMN "armsItemId" INTEGER,
  ADD COLUMN "leftHandItemId" INTEGER,
  ADD COLUMN "rightHandItemId" INTEGER;
