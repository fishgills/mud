#!/bin/sh
set -e

echo "🚀 DM Service startup..."

# Run database migrations
# echo "📦 Running database migrations..."
# cd libs/database
# npx prisma migrate deploy || {
#   echo "⚠️  Migration failed, but continuing (may be first run)"
# }

cd /app

# Start the application
echo "✅ Starting DM service..."
exec node apps/dm/dist/main.js
