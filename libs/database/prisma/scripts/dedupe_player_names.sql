DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'Player'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        name,
        lower(name) AS normalized_name,
        row_number() OVER (PARTITION BY lower(name) ORDER BY id) AS rn
      FROM "Player"
    )
    UPDATE "Player" AS p
    SET name = p.name || '-' || p.id
    FROM ranked AS r
    WHERE p.id = r.id
      AND r.rn > 1;
  END IF;
END $$;
