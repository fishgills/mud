#!/bin/sh
set -e

echo "🚀 DM Service startup..."

# Run database migrations
echo "📦 Running database migrations..."
cd libs/database
echo "⏳ Executing: npx prisma migrate deploy"
npx prisma migrate deploy
echo "✅ Database migrations complete"

cd /app

# Start the application
echo "✅ Starting DM service..."
exec node apps/dm/dist/src/main.js
