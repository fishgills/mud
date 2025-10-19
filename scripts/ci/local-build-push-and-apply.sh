#!/usr/bin/env bash
set -euo pipefail

# Build and push images, then terraform apply to update Cloud Run to this tag.
# Usage: ./scripts/ci/local-build-push-and-apply.sh [project_id] [region] [tag]
# - If project/region omitted, falls back to gcloud config.
# - If tag omitted, uses short git SHA.

PROJECT_ID=${1:-}
REGION=${2:-}
TAG=${3:-}
ARTIFACT_REPO=${ARTIFACT_REPO:-mud-registry}

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
  echo "Usage: $0 [project_id] [region] [tag]" >&2
  echo "Hint: set defaults via 'gcloud config set project <id>' and 'gcloud config set run/region <region>'" >&2
  exit 1
fi

if [[ -z "$TAG" ]]; then
  TAG=$(git rev-parse --short=12 HEAD)
fi

echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Tag:     $TAG"

echo "Configuring docker auth..."
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

set -x

docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/dm:$TAG" -f apps/dm/Dockerfile .

docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/world:$TAG" -f apps/world/Dockerfile .

docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/slack-bot:$TAG" -f apps/slack-bot/Dockerfile .

docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/tick:$TAG" -f apps/tick/Dockerfile .
set +x

echo "Pushing images..."
set -x

docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/dm:$TAG"
docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/world:$TAG"
docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/slack-bot:$TAG"
docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$ARTIFACT_REPO/tick:$TAG"
set +x

echo "Running terraform apply..."
"$(dirname "$0")/local-tf-apply.sh" "$PROJECT_ID" "$REGION" "$TAG"
