#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bootstrap-terraform.sh --project <PROJECT_ID> --bucket <STATE_BUCKET> --tf-service-account <SA_EMAIL> [options]

Options:
  --user-email <EMAIL>        Optional user email to grant storage access for local Terraform runs.
  --compute-service-account   Runtime service account for Cloud Run (defaults to <PROJECT_NUMBER>-compute@developer.gserviceaccount.com).
  --runtime-service-account   Additional runtime service account(s) to grant Service Account User on. Repeat or pass a comma-separated list.

Examples:
  ./scripts/bootstrap-terraform.sh \
    --project battleforge-444008 \
    --bucket mud-terraform-state \
    --tf-service-account github-actions@battleforge-444008.iam.gserviceaccount.com

The script assumes you are authenticated with gcloud and have permission to
update IAM policies for the specified project and bucket.
EOF
}

PROJECT=""
STATE_BUCKET=""
TF_SA=""
USER_EMAIL=""
RUNTIME_SAS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      PROJECT="$2"
      shift 2
      ;;
    --bucket)
      STATE_BUCKET="$2"
      shift 2
      ;;
    --tf-service-account)
      TF_SA="$2"
      shift 2
      ;;
    --user-email)
      USER_EMAIL="$2"
      shift 2
      ;;
    --compute-service-account)
      RUNTIME_SAS+=("$2")
      shift 2
      ;;
    --runtime-service-account)
      IFS=',' read -r -a values <<< "$2"
      for value in "${values[@]}"; do
        if [[ -n "$value" ]]; then
          RUNTIME_SAS+=("$value")
        fi
      done
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$PROJECT" || -z "$STATE_BUCKET" || -z "$TF_SA" ]]; then
  echo "Missing required arguments." >&2
  usage
  exit 1
fi

# Normalize bucket name (allow passing with or without gs://)
if [[ "$STATE_BUCKET" != gs://* ]]; then
  STATE_BUCKET="gs://$STATE_BUCKET"
fi

if [[ ${#RUNTIME_SAS[@]} -eq 0 ]]; then
  PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
  if [[ -z "$PROJECT_NUMBER" ]]; then
    echo "Failed to determine project number for $PROJECT" >&2
    exit 1
  fi
  RUNTIME_SAS=("${PROJECT_NUMBER}-compute@developer.gserviceaccount.com")
fi

# Deduplicate runtime service accounts in case flags were repeated.
if [[ ${#RUNTIME_SAS[@]} -gt 0 ]]; then
  declare -A _seen_sa=()
  deduped=()
  for sa in "${RUNTIME_SAS[@]}"; do
    [[ -z "$sa" ]] && continue
    if [[ -z "${_seen_sa[$sa]:-}" ]]; then
      deduped+=("$sa")
      _seen_sa[$sa]=1
    fi
  done
  RUNTIME_SAS=("${deduped[@]}")
fi

run() {
  printf '\n> %s\n' "$*"
  eval "$@"
}

echo "Granting storage.objectAdmin on $STATE_BUCKET to $TF_SA"
run gcloud storage buckets add-iam-policy-binding "$STATE_BUCKET" \
  --member="serviceAccount:${TF_SA}" \
  --role="roles/storage.objectAdmin"

if [[ -n "$USER_EMAIL" ]]; then
  echo "Granting storage.objectAdmin on $STATE_BUCKET to user $USER_EMAIL"
  run gcloud storage buckets add-iam-policy-binding "$STATE_BUCKET" \
    --member="user:${USER_EMAIL}" \
    --role="roles/storage.objectAdmin"
fi

echo "Granting roles/iam.serviceAccountAdmin on $PROJECT to $TF_SA"
run gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${TF_SA}" \
  --role="roles/iam.serviceAccountAdmin"

echo "Granting roles/iam.workloadIdentityPoolAdmin on $PROJECT to $TF_SA"
run gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${TF_SA}" \
  --role="roles/iam.workloadIdentityPoolAdmin"

for runtime_sa in "${RUNTIME_SAS[@]}"; do
  echo "Granting roles/iam.serviceAccountUser on $runtime_sa to $TF_SA"
  run gcloud iam service-accounts add-iam-policy-binding "$runtime_sa" \
    --project="$PROJECT" \
    --member="serviceAccount:${TF_SA}" \
    --role="roles/iam.serviceAccountUser"
done

echo "Bootstrap complete."
