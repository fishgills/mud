#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  cat <<USAGE
Usage: ./apps/dm/test-dm.sh <scenario> [jest-args]

Scenarios:
  guild-teleport   Run Jest suites tagged with "guild-teleport"
USAGE
  exit 1
fi

SCENARIO="$1"
shift || true

case "$SCENARIO" in
  guild-teleport)
    yarn workspace @mud/dm test --runInBand --testNamePattern="guild-teleport" "$@"
    ;;
  *)
    echo "Unknown scenario: $SCENARIO" >&2
    exit 1
    ;;
esac
