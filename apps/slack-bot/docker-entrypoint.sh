#!/bin/sh
set -e

echo "🚀 Slack Bot startup..."

# Run backfill for clientId/clientType (if needed)
echo "🔄 Backfilling client IDs..."
cd libs/database
npx tsx scripts/backfill-client-ids.ts || {
  echo "⚠️  Backfill failed, but continuing"
}

cd /app

# Start the application
echo "✅ Starting Slack Bot service..."
exec node apps/slack-bot/dist/main.js
