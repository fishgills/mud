#!/bin/bash
# Usage: ./render-map-2d.sh [x] [y]
# Default center is (0,0) if not provided
set -euo pipefail

X=${1:-0}
Y=${2:-0}

# Render endpoint (adjust if needed)
ENDPOINT="http://localhost:3001/world/render/map-tiles"

RESPONSE=$(curl -s "$ENDPOINT?x=$X&y=$Y")

if ! command -v jq &> /dev/null; then
  echo "jq is required for this script. Please install jq."
  exit 1
fi

jq -r '.[] | map(.symbol // " ") | join("")' <<< "$RESPONSE"

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
