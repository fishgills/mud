#!/bin/bash
set -e

# Script to deploy app to Cloud Run
# Usage: ./deploy-to-cloudrun.sh <app_name> <registry> <project_id> <artifact_repo> <git_sha> <region>

APP="${1}"
REGISTRY="${2}"
PROJECT_ID="${3}"
ARTIFACT_REPO="${4}"
GIT_SHA="${5}"
REGION="${6}"

if [ -z "$APP" ] || [ -z "$REGISTRY" ] || [ -z "$PROJECT_ID" ] || [ -z "$ARTIFACT_REPO" ] || [ -z "$GIT_SHA" ] || [ -z "$REGION" ]; then
  echo "Usage: ./deploy-to-cloudrun.sh <app_name> <registry> <project_id> <artifact_repo> <git_sha> <region>"
  exit 1
fi

IMAGE_TAG="${REGISTRY}/${PROJECT_ID}/${ARTIFACT_REPO}/${APP}:${GIT_SHA}"
SERVICE_NAME="mud-${APP}"

echo "Deploying $APP to Cloud Run..."
# Update the existing Cloud Run service image
# This only updates the container image, preserving all other Terraform-managed settings
gcloud run services update "$SERVICE_NAME" \
  --image="$IMAGE_TAG" \
  --region="$REGION" \
  --platform=managed \
  --quiet

echo "✅ Successfully deployed $APP to Cloud Run"
