#!/bin/sh
set -e

echo "🚀 DM Service startup..."

# Run database migrations
echo "📦 Running database migrations..."
cd libs/database
npx prisma migrate deploy

cd /app

# Start the application
echo "✅ Starting DM service..."
exec node apps/dm/dist/src/main.js
