#!/bin/sh
set -e

echo "🚀 DM Service startup..."

# Run database migrations (and heal any known failures automatically)
echo "📦 Running database migrations..."
cd libs/database

# The 20251122044738_guild_tweaks migration previously failed in prod because we
# attempted to drop the PlayerGuildState FK after the table was removed. Since
# we can't shell into prod manually, proactively mark it as rolled back so we
# can re-run the guarded migration. The resolve command is idempotent: if the
# migration is already cleaned up it exits with a non-zero status, so we mask
# that result.
echo "🩹 Ensuring failed migrations are resolved..."
set +e
npx prisma migrate resolve --rolled-back 20251122044738_guild_tweaks >/dev/null 2>&1
RESOLVE_STATUS=$?
set -e
if [ "$RESOLVE_STATUS" -eq 0 ]; then
  echo "✅ Marked 20251122044738_guild_tweaks as rolled back before deploy"
else
  echo "ℹ️ No failed 20251122044738_guild_tweaks migration to resolve (status $RESOLVE_STATUS)"
fi

echo "⏳ Executing: npx prisma migrate deploy"
npx prisma migrate deploy
echo "✅ Database migrations complete"

cd /app

# Start the application
echo "✅ Starting DM service..."
exec node apps/dm/dist/src/main.js
