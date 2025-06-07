#!/bin/bash

# DM Service Test Script
# Demonstrates the basic functionality of the DM service

BASE_URL="http://localhost:3000/api/dm"

echo "🎮 Testing DM Service Functionality"
echo "=================================="

# Test health check
echo "📊 1. Health Check"
curl -s "$BASE_URL/health" | jq '.'
echo ""

# Create a test player
echo "👤 2. Creating Test Player"
PLAYER_RESPONSE=$(curl -s -X POST "$BASE_URL/player" \
  -H "Content-Type: application/json" \
  -d '{"slackId": "U123TEST", "name": "TestHero"}')
echo $PLAYER_RESPONSE | jq '.'
echo ""

# Get player info
echo "📍 3. Getting Player Info"
curl -s "$BASE_URL/player/U123TEST" | jq '.'
echo ""

# Move player north
echo "🏃 4. Moving Player North"
curl -s -X POST "$BASE_URL/player/U123TEST/move" \
  -H "Content-Type: application/json" \
  -d '{"direction": "n"}' | jq '.'
echo ""

# Get game state
echo "🌍 5. Getting Game State"
curl -s "$BASE_URL/game-state" | jq '.'
echo ""

# Spawn a monster for testing
echo "👹 6. Spawning Monster at (0, -1)"
curl -s -X POST "$BASE_URL/admin/spawn-monster/0/-1" | jq '.'
echo ""

# Get location info
echo "🗺️  7. Getting Location Info at (0, -1)"
curl -s "$BASE_URL/location/0/-1" | jq '.'
echo ""

# Process a game tick
echo "⏰ 8. Processing Game Tick"
curl -s -X POST "$BASE_URL/tick" | jq '.'
echo ""

# Try to attack the monster
echo "⚔️  9. Attempting to Attack Monster"
MONSTERS_RESPONSE=$(curl -s "$BASE_URL/monsters")
MONSTER_ID=$(echo $MONSTERS_RESPONSE | jq -r '.data[0].id // empty')

if [ ! -z "$MONSTER_ID" ]; then
    echo "Found monster with ID: $MONSTER_ID"
    curl -s -X POST "$BASE_URL/player/U123TEST/attack" \
      -H "Content-Type: application/json" \
      -d "{\"targetType\": \"monster\", \"targetId\": $MONSTER_ID}" | jq '.'
else
    echo "No monsters found to attack"
fi
echo ""

echo "✅ DM Service test complete!"
echo ""
echo "Available endpoints:"
echo "- GET  $BASE_URL/health"
echo "- POST $BASE_URL/tick"
echo "- POST $BASE_URL/player"
echo "- GET  $BASE_URL/player/:slackId"
echo "- POST $BASE_URL/player/:slackId/move"
echo "- POST $BASE_URL/player/:slackId/attack"
echo "- POST $BASE_URL/player/:slackId/respawn"
echo "- GET  $BASE_URL/game-state"
echo "- GET  $BASE_URL/players"
echo "- GET  $BASE_URL/monsters"
echo "- GET  $BASE_URL/location/:x/:y"
echo "- POST $BASE_URL/admin/spawn-monster/:x/:y"
