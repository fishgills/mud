#!/usr/bin/env bash
set -euo pipefail

APPS_DIR="apps"

REGION=${REGION:-us-central1}
PROJECT_ID=${PROJECT_ID:-battleforge-444008}
ARTIFACT_REPO=${ARTIFACT_REPO:-mud-registry}
REGISTRY_HOST="${REGION}-docker.pkg.dev"

if [[ -n "${APP_TAG:-}" ]]; then
  IMAGE_TAG="$APP_TAG"
elif command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  IMAGE_TAG=$(git rev-parse --short HEAD)
else
  IMAGE_TAG=$(date +%Y%m%d%H%M%S)
fi

if [[ -z "$IMAGE_TAG" ]]; then
  echo "Unable to determine image tag." >&2
  exit 1
fi

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_SHA=$(git rev-parse HEAD)
else
  GIT_SHA=""
fi

echo "Building app images from $APPS_DIR (context: repository root)"
echo "Registry: ${REGISTRY_HOST}/${PROJECT_ID}/${ARTIFACT_REPO}"
echo "Tags: latest, ${IMAGE_TAG}"

build_and_optionally_push() {
  local app_name=$1
  local dockerfile_path=$2
  local image_uri=$3

  echo "Building ${image_uri}:{latest,${IMAGE_TAG}} using ${dockerfile_path}"
  build_args=(
    docker build
    -f "$dockerfile_path"
    -t "${image_uri}:latest"
    -t "${image_uri}:${IMAGE_TAG}"
  )
  if [[ -n "$GIT_SHA" ]]; then
    build_args+=(--build-arg "GIT_SHA=${GIT_SHA}")
  fi
  build_args+=(".")
  "${build_args[@]}"

  if [[ "${PUSH_IMAGES:-0}" == "1" ]]; then
    echo "Pushing ${image_uri}:latest"
    docker push "${image_uri}:latest"
    echo "Pushing ${image_uri}:${IMAGE_TAG}"
    docker push "${image_uri}:${IMAGE_TAG}"
  fi
}

found_app=0
for app_path in "$APPS_DIR"/*; do
  [[ -d "$app_path" ]] || continue
  if [[ -f "$app_path/Dockerfile" ]]; then
    found_app=1
    app_name=$(basename "$app_path")
    image="${REGISTRY_HOST}/${PROJECT_ID}/${ARTIFACT_REPO}/${app_name}"
    build_and_optionally_push "$app_name" "$app_path/Dockerfile" "$image"
  else
    echo "Skipping $(basename "$app_path") (no Dockerfile)"
  fi
done

if [[ "$found_app" == "0" ]]; then
  echo "No app directories with Dockerfile found in $APPS_DIR" >&2
  exit 1
fi

echo "All app images processed."
