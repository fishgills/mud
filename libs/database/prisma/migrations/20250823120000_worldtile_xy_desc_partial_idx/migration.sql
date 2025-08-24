-- Create a partial index to accelerate lookups of described tiles within bounds
-- This keeps the btree small and focused, since most tiles are undescribed.
-- Postgres-only feature (WHERE clause on index)

-- Composite index on (x, y) filtered by description IS NOT NULL
CREATE INDEX IF NOT EXISTS "WorldTile_xy_desc_idx"
  ON "WorldTile" ("x", "y")
  WHERE "description" IS NOT NULL;
