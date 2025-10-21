#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/ci/local-tf-apply.sh [project_id] [region] [zone]
# - If project/region are omitted, falls back to gcloud config.
# - Zone defaults to the region's "-a" zone when omitted.

PROJECT_ID=${1:-}
REGION=${2:-}
ZONE=${3:-}

if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
fi

if [[ -z "$REGION" ]]; then
  REGION=$(gcloud config get-value run/region 2>/dev/null || true)
  if [[ -z "$REGION" ]]; then
    REGION=$(gcloud config get-value compute/region 2>/dev/null || true)
  fi
fi

if [[ -z "$PROJECT_ID" || -z "$REGION" ]]; then
  echo "Usage: $0 [project_id] [region] [zone]" >&2
  echo "Hint: set defaults via 'gcloud config set project <id>' and 'gcloud config set run/region <region>'" >&2
  exit 1
fi

if [[ -z "$ZONE" ]]; then
  ZONE="${REGION}-a"
fi

echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Zone:    $ZONE"

pushd "$(dirname "$0")/../../infra/terraform" >/dev/null
terraform init -input=false
TF_VAR_project_id="$PROJECT_ID" \
TF_VAR_region="$REGION" \
TF_VAR_zone="$ZONE" \
terraform apply -auto-approve -input=false
popd >/dev/null
