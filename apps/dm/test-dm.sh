#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  cat <<USAGE
Usage: ./apps/dm/test-dm.sh <scenario> [jest-args]

Scenarios:
  guild-teleport   Run Jest suites tagged with "guild-teleport"
  guild-shop       Run Jest suites tagged with "guild-shop"
  guild-crier      Run Jest suites tagged with "guild-announcement"
USAGE
  exit 1
fi

SCENARIO="$1"
shift || true

case "$SCENARIO" in
  guild-teleport)
    yarn workspace @mud/dm test --runInBand --testNamePattern="guild-teleport" "$@"
    ;;
  guild-shop)
    yarn workspace @mud/dm test --runInBand --testNamePattern="guild-shop" "$@"
    ;;
  guild-crier)
    yarn workspace @mud/dm test --runInBand --testNamePattern="guild-announcement" "$@"
    ;;
  *)
    echo "Unknown scenario: $SCENARIO" >&2
    exit 1
    ;;
esac
