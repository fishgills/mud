#!/bin/bash
# Usage: ./render-map-2d.sh [x] [y]
# Default center is (0,0) if not provided
set -euo pipefail

X=${1:-0}
Y=${2:-0}

# GraphQL endpoint (adjust if needed)
ENDPOINT="http://localhost:3000/graphql"


RAW_QUERY=$(cat <<EOM
{
  renderMapTiles(x: $X, y: $Y) {
    x
    y
    biomeName
    symbol
    hasSettlement
    isSettlementCenter
  }
}
EOM
)

# Encode the query as JSON using jq for safety
JSON_BODY=$(jq -Rs --arg query "$RAW_QUERY" '{query: $query}' <<< "$RAW_QUERY")

# Query the GraphQL API and extract the 2D array
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
  --data-binary "$JSON_BODY" "$ENDPOINT")

# Use jq to extract and print the map
if ! command -v jq &> /dev/null; then
  echo "jq is required for this script. Please install jq."
  exit 1
fi

# Print each row as a string
jq -r '.data.renderMapTiles[] | map(.symbol // " ") | join("")' <<< "$RESPONSE"

# Print the legend (matching render.resolver.ts)
cat <<'LEGEND'

Legend:
  g = Grassland
  t = Tundra
  P = Taiga
  T = Forest
  d = Desert
  s = Swamp
  m = Mountain
  w = Water
  ^ = Settlement Center
  * = Settlement

LEGEND
