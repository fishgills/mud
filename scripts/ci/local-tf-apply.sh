#!/usr/bin/env bash
set -euo pipefail

#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/ci/local-tf-apply.sh [project_id] [region] [image_tag]
# - If project/region are omitted, falls back to gcloud config.
# - If image_tag is omitted, uses the short git SHA.

PROJECT_ID=${1:-}
REGION=${2:-}
TAG=${3:-}

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
  echo "Usage: $0 [project_id] [region] [image_tag]" >&2
  echo "Hint: set defaults via 'gcloud config set project <id>' and 'gcloud config set run/region <region>'" >&2
  exit 1
fi

if [[ -z "$TAG" ]]; then
  TAG=$(git rev-parse --short=12 HEAD)
fi

echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Image tag: $TAG"

pushd "$(dirname "$0")/../../infra/terraform" >/dev/null
terraform init -input=false
TF_VAR_project_id="$PROJECT_ID" \
TF_VAR_region="$REGION" \
TF_VAR_image_version="$TAG" \
TF_VAR_git_commit_sha="$TAG" \
terraform apply -auto-approve -input=false
popd >/dev/null
