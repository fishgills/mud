#!/bin/sh
set -e

echo "🚀 DM Service startup..."

# Run database migrations
echo "📦 Running database migrations..."
cd libs/database
npx prisma migrate deploy

cd /app

GUILD_SEED_ENABLED="${GUILD_SEED_ENABLED:-true}"
if [ "$GUILD_SEED_ENABLED" = "true" ]; then
  echo "🌱 Seeding guild hall data..."
  SEED_CATALOG="${GUILD_SEED_CATALOG_PATH:-apps/dm/scripts/data/guild-catalog.json}"
  SEED_ANNOUNCEMENTS="${GUILD_SEED_ANNOUNCEMENTS_PATH:-apps/dm/scripts/data/guild-announcements.json}"

  if [ -f "$SEED_CATALOG" ] && [ -f "$SEED_ANNOUNCEMENTS" ]; then
    RESET_ARG=""
    if [ "${GUILD_SEED_RESET:-false}" = "true" ]; then
      RESET_ARG="--reset"
    fi

    node apps/dm/scripts/seed-guild.js \
      --tile "${GUILD_SEED_TILE:-guild-hall}" \
      --name "${GUILD_SEED_NAME:-Adventurers Guild Hall}" \
      --catalog "$SEED_CATALOG" \
      --announcements "$SEED_ANNOUNCEMENTS" \
      --coords "${GUILD_SEED_COORDS:-0,0,0}" \
      --arrival "${GUILD_SEED_ARRIVAL:-✨ You arrive inside the Guild Hall. Merchants wave you over while the town crier rehearses the latest rumors.}" \
      --cooldown "${GUILD_SEED_COOLDOWN_SECONDS:-300}" \
      --population "${GUILD_SEED_POPULATION_LIMIT:-50}" \
      $RESET_ARG
  else
    echo "⚠️  Guild seed skipped: missing fixture files ($SEED_CATALOG / $SEED_ANNOUNCEMENTS)"
  fi
else
  echo "⏭️  Skipping guild seed (GUILD_SEED_ENABLED=$GUILD_SEED_ENABLED)"
fi

# Start the application
echo "✅ Starting DM service..."
exec node apps/dm/dist/src/main.js
