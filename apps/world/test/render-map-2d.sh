#!/bin/bash
# Usage: ./render-map-2d.sh [x] [y]
# Default center is (0,0) if not provided
set -euo pipefail

X=${1:-0}
Y=${2:-0}

# REST endpoint for map tiles
ENDPOINT="http://localhost:3000/world/render/map-tiles"

# Query the REST API and extract the 2D array
RESPONSE=$(curl -s -G "$ENDPOINT" --data-urlencode "x=$X" --data-urlencode "y=$Y")

# Use jq to extract and print the map
if ! command -v jq &> /dev/null; then
  echo "jq is required for this script. Please install jq."
  exit 1
fi

# Print each row as a string
jq -r '.[] | map(.symbol // " ") | join("")' <<< "$RESPONSE"

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
