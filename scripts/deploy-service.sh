#!/usr/bin/env bash
set -euo pipefail
set -x

usage() {
  cat <<'EOF'
Usage: deploy-service.sh --service <name> [options]

Options:
  --service, -s      Service name under apps/ and image suffix (required)
  --tag, -t          Override the image tag
  --deployment, -d   Kubernetes deployment name (default: service name)
  --container, -c    Kubernetes container name (default: service name)
  --namespace, -n    Kubernetes namespace (default: mud)
  --dry-run          Print commands without executing them
  --help, -h         Show this help message

Environment variables:
  REGION             Artifact Registry region (default: us-central1)
  PROJECT_ID         GCP project ID (default: battleforge-444008)
  ARTIFACT_REPO      Artifact Registry repo (default: mud-services)
EOF
}

DRY_RUN=0
SERVICE=""
CUSTOM_TAG=""
DEPLOYMENT_NAME=""
CONTAINER_NAME=""
NAMESPACE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service|-s)
      SERVICE="$2"
      shift 2
      ;;
    --tag|-t)
      CUSTOM_TAG="$2"
      shift 2
      ;;
    --deployment|-d)
      DEPLOYMENT_NAME="$2"
      shift 2
      ;;
    --container|-c)
      CONTAINER_NAME="$2"
      shift 2
      ;;
    --namespace|-n)
      NAMESPACE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$SERVICE" ]]; then
  echo "--service flag is required." >&2
  usage
  exit 1
fi

REGION=${REGION:-us-central1}
PROJECT_ID=${PROJECT_ID:-battleforge-444008}
ARTIFACT_REPO=${ARTIFACT_REPO:-mud-services}
DEPLOYMENT_NAME=${DEPLOYMENT_NAME:-$SERVICE}
CONTAINER_NAME=${CONTAINER_NAME:-$SERVICE}
NAMESPACE=${NAMESPACE:-mud}
REGISTRY_HOST="${REGION}-docker.pkg.dev"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

DOCKERFILE="apps/${SERVICE}/Dockerfile"
if [[ ! -f "$DOCKERFILE" ]]; then
  echo "Dockerfile not found at ${DOCKERFILE}." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker command not found." >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl command not found." >&2
  exit 1
fi

if [[ -n "$CUSTOM_TAG" ]]; then
  IMAGE_TAG="$CUSTOM_TAG"
else
  BRANCH=""
  if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
    BRANCH=${BRANCH//\//-}
  fi
  generate_suffix() {
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -hex 3
      return
    fi

    # head closes the pipe early; disable pipefail to avoid treating SIGPIPE as fatal
    set +o pipefail
    local suffix
    suffix=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c6 || true)
    set -o pipefail
    printf '%s' "$suffix"
  }

  RAND_SUFFIX=$(generate_suffix)
  if [[ -z "$RAND_SUFFIX" ]]; then
    RAND_SUFFIX=$(date +%s | sha256sum | cut -c1-6)
  fi
  DATE_TAG=$(date +%Y%m%d%H%M%S)
  if [[ -n "$BRANCH" ]]; then
    IMAGE_TAG="${BRANCH}-${DATE_TAG}-${RAND_SUFFIX}"
  else
    IMAGE_TAG="${DATE_TAG}-${RAND_SUFFIX}"
  fi
fi

IMAGE_PATH="${REGISTRY_HOST}/${PROJECT_ID}/${ARTIFACT_REPO}/${SERVICE}"
IMAGE_URI="${IMAGE_PATH}:${IMAGE_TAG}"

run_cmd() {
  echo "+ $*"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    "$@"
  fi
}

BUILD_CMD=(docker build -t "$IMAGE_URI" -f "$DOCKERFILE" "$REPO_ROOT")
run_cmd "${BUILD_CMD[@]}"

PUSH_CMD=(docker push "$IMAGE_URI")
run_cmd "${PUSH_CMD[@]}"

SET_IMAGE_CMD=(kubectl set image "deployment/${DEPLOYMENT_NAME}" "${CONTAINER_NAME}=${IMAGE_URI}" -n "$NAMESPACE")
run_cmd "${SET_IMAGE_CMD[@]}"

ROLLOUT_CMD=(kubectl rollout status "deployment/${DEPLOYMENT_NAME}" -n "$NAMESPACE")
run_cmd "${ROLLOUT_CMD[@]}"

echo "Deployment updated to ${IMAGE_URI}"