-- Add rank column to Item templates so base item rank can be persisted
ALTER TABLE "public"."Item" ADD COLUMN IF NOT EXISTS "rank" integer;
-- (Optional) Add rank columns to player/world items; keep nullable
ALTER TABLE "public"."PlayerItem" ADD COLUMN IF NOT EXISTS "rank" integer;
ALTER TABLE "public"."WorldItem" ADD COLUMN IF NOT EXISTS "rank" integer;
