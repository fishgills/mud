#!/bin/bash
set -e

# Script to check if infrastructure changes are needed
# Usage: ./check-infra-changes.sh [manual|auto] [deploy_infra] [before_sha] [after_sha] [github_output_file]

MODE="${1:-auto}"
DEPLOY_INFRA="${2:-false}"
BEFORE_SHA="${3}"
AFTER_SHA="${4}"
GITHUB_OUTPUT="${5:-/dev/stdout}"

if [ "$MODE" == "manual" ]; then
  # Manual deployment mode - use provided input
  if [ "$DEPLOY_INFRA" == "true" ]; then
    echo "changed=true" >> "$GITHUB_OUTPUT"
    echo "Manual deployment - infrastructure enabled"
  else
    echo "changed=false" >> "$GITHUB_OUTPUT"
    echo "Manual deployment - infrastructure disabled"
  fi
else
  # Automatic mode - check if any files in infra/ have changed
  if git diff --name-only "$BEFORE_SHA" "$AFTER_SHA" | grep -q "^infra/"; then
    echo "changed=true" >> "$GITHUB_OUTPUT"
    echo "Infrastructure changes detected"
  else
    echo "changed=false" >> "$GITHUB_OUTPUT"
    echo "No infrastructure changes"
  fi
fi
