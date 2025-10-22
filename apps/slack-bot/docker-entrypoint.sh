#!/bin/sh
set -e

echo "🚀 Slack Bot startup..."

cd /app

# Start the application
echo "✅ Starting Slack Bot service..."
exec node apps/slack-bot/dist/main.js
