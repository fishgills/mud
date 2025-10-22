#!/usr/bin/env bash
set -euo pipefail

cat <<'MSG' >&2
This helper now targets a single VPS deployment.
Please run: ./scripts/deploy-vps.sh <host> <user> <deploy_path> <tag> [ssh_key]
MSG

exit 1
