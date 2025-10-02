#!/bin/bash
set -e

# Script to detect affected applications for deployment
# Usage: ./detect-affected-apps.sh [manual|auto] [apps_input] [github_output_file]

MODE="${1:-auto}"
APPS_INPUT="${2:-all}"
GITHUB_OUTPUT="${3:-/dev/stdout}"

if [ "$MODE" == "manual" ]; then
  # Manual deployment mode - use provided apps input
  if [ "$APPS_INPUT" == "all" ]; then
    APPS='["dm","slack-bot","tick","world"]'
  else
    # Convert comma-separated list to JSON array
    APPS=$(echo "$APPS_INPUT" | jq -Rc 'split(",") | map(gsub("^\\s+|\\s+$"; ""))')
  fi
  echo "Manual deployment - apps: $APPS"
else
  # Automatic mode - detect affected projects using turbo
  RAW_OUTPUT=$(yarn --silent turbo run build --dry=json --filter='[HEAD^]' || true)
  AFFECTED_OUTPUT=$(python3 -c 'import json, sys; data = sys.stdin.read(); start = data.find("{"); end = data.rfind("}"); print(json.dumps({"tasks": []}) if start == -1 or end == -1 or end < start else data[start:end+1])' <<< "$RAW_OUTPUT")
  
  if [ -z "$AFFECTED_OUTPUT" ]; then
    AFFECTED_OUTPUT='{"tasks":[]}'
  fi

  # Extract application names from affected tasks
  APPS=$(echo "$AFFECTED_OUTPUT" | jq -c '[.tasks[] | select(.package | startswith("@mud/")) | .package | sub("@mud/"; "")] | unique | map(select(. == "dm" or . == "slack-bot" or . == "tick" or . == "world"))')
  echo "Affected apps: $APPS"

  # Extract all packages (including libs)
  PACKAGES=$(echo "$AFFECTED_OUTPUT" | jq -c '[.tasks[] | select(.package | startswith("@mud/")) | .package | sub("@mud/"; "")] | unique')
  echo "Affected packages: $PACKAGES"
  echo "packages=$PACKAGES" >> "$GITHUB_OUTPUT"
  
  HAS_PACKAGES=$(echo "$PACKAGES" | jq 'length > 0')
  echo "has-packages=$HAS_PACKAGES" >> "$GITHUB_OUTPUT"
fi

# Output results
echo "apps=$APPS" >> "$GITHUB_OUTPUT"

HAS_APPS=$(echo "$APPS" | jq 'length > 0')
echo "has-apps=$HAS_APPS" >> "$GITHUB_OUTPUT"
