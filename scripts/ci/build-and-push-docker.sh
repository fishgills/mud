#!/bin/bash
set -e

# Script to build and push Docker images to Artifact Registry
# Usage: ./build-and-push-docker.sh <app_name> <registry> <project_id> <artifact_repo> <git_sha>

APP="${1}"
REGISTRY="${2}"
PROJECT_ID="${3}"
ARTIFACT_REPO="${4}"
GIT_SHA="${5}"

if [ -z "$APP" ] || [ -z "$REGISTRY" ] || [ -z "$PROJECT_ID" ] || [ -z "$ARTIFACT_REPO" ] || [ -z "$GIT_SHA" ]; then
  echo "Usage: ./build-and-push-docker.sh <app_name> <registry> <project_id> <artifact_repo> <git_sha>"
  exit 1
fi

IMAGE_TAG="${REGISTRY}/${PROJECT_ID}/${ARTIFACT_REPO}/${APP}:${GIT_SHA}"
IMAGE_LATEST="${REGISTRY}/${PROJECT_ID}/${ARTIFACT_REPO}/${APP}:latest"

echo "Building Docker image for $APP..."
docker build \
  --pull \
  -f "apps/${APP}/Dockerfile" \
  --build-arg "GIT_SHA=${GIT_SHA}" \
  --label "org.opencontainers.image.revision=${GIT_SHA}" \
  -t "$IMAGE_TAG" \
  -t "$IMAGE_LATEST" \
  .

echo "Pushing Docker images..."
docker push "$IMAGE_TAG"
docker push "$IMAGE_LATEST"

echo "✅ Successfully built and pushed $APP"
