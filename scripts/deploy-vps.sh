#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REMOTE_PATH="/opt/mud"
DEFAULT_ENV_FILE=".env.prod"
DEFAULT_NGINX_DIR="data/nginx"

DEFAULT_SSH_KEY="${HOME}/.ssh/mud-vps"
DEFAULT_INSTANCE="mud-vps"
DEFAULT_PROJECT="battleforge-444008"
DEFAULT_COMPOSE_FILE="docker-compose.prod.yml"
DEFAULT_USER="fishgills_fishgills_net"

REMOTE_PATH=${1:-$DEFAULT_REMOTE_PATH}
ENV_FILE=${2:-$DEFAULT_ENV_FILE}
NGINX_DIR=${3:-$DEFAULT_NGINX_DIR}
SSH_KEY=${4:-$DEFAULT_SSH_KEY}
GCLOUD_INSTANCE=${5:-${DEPLOY_INSTANCE:-$DEFAULT_INSTANCE}}
GCP_PROJECT=${6:-${GCP_PROJECT:-$DEFAULT_PROJECT}}
LOCAL_COMPOSE_FILE=${7:-$DEFAULT_COMPOSE_FILE}
REMOTE_USER=${8:-${DEPLOY_USER:-$DEFAULT_USER}}
SSH_HOST_OVERRIDE=${9:-${SSH_HOST:-}}

if [[ ! -d "$NGINX_DIR" ]]; then
  echo "Missing nginx config directory: $NGINX_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$LOCAL_COMPOSE_FILE" ]]; then
  echo "Missing compose file: $LOCAL_COMPOSE_FILE" >&2
  exit 1
fi

SSH_HOST="$SSH_HOST_OVERRIDE"
SSH_TARGET=""
SSH_OPTIONS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTIONS+=(-i "$SSH_KEY")
fi

if [[ ! -f "$SSH_KEY" ]]; then
  echo "Missing SSH key: $SSH_KEY" >&2
  exit 1
fi

if [[ -z "$SSH_HOST" && -n "$GCLOUD_INSTANCE" ]]; then
  if command -v gcloud >/dev/null 2>&1; then
    echo "Looking up external IP for instance ${GCLOUD_INSTANCE} via gcloud..."
    project_arg=()
    if [[ -n "$GCP_PROJECT" ]]; then
      project_arg+=(--project="$GCP_PROJECT")
    fi
    ip=$(gcloud compute instances describe "$GCLOUD_INSTANCE" --format="value(networkInterfaces[0].accessConfigs[0].natIP)" "${project_arg[@]}" 2>/dev/null || true)
    ip=$(echo "$ip" | tr -d '\r')
    if [[ -n "$ip" ]]; then
      SSH_HOST="$ip"
      echo "Using IP ${SSH_HOST} for SSH connections."
    else
      echo "WARNING: gcloud did not return an external IP for instance ${GCLOUD_INSTANCE}." >&2
    fi
  else
    echo "WARNING: gcloud CLI not found; cannot resolve instance ${GCLOUD_INSTANCE}." >&2
  fi
fi

if [[ -z "$SSH_HOST" ]]; then
  echo "Unable to determine SSH host. Provide the IP or hostname as the 9th argument or via SSH_HOST env var." >&2
  exit 1
fi

SSH_TARGET="${REMOTE_USER}@${SSH_HOST}"
echo "Connecting as ${SSH_TARGET}"

RSYNC_SSH="ssh"
for opt in "${SSH_OPTIONS[@]}"; do
  RSYNC_SSH+=" $opt"
done

ssh_command() {
  local remote_cmd="$1"
  ssh "${SSH_OPTIONS[@]}" "$SSH_TARGET" "$remote_cmd"
}

ensure_remote_path_not_directory() {
  local remote_rel=$1
  local remote_full="${REMOTE_PATH}/${remote_rel}"
  ssh_command "if [ -d '$remote_full' ]; then echo 'Removing remote directory blocking file ${remote_full}'; rm -rf '$remote_full'; fi"
}

transfer_file() {
  local src=$1 dest=$2
  if command -v rsync >/dev/null 2>&1; then
    rsync -avz -e "$RSYNC_SSH" "$src" "$SSH_TARGET:$dest"
  else
    scp "${SSH_OPTIONS[@]}" "$src" "$SSH_TARGET:$dest"
  fi
}

transfer_directory() {
  local src=$1 dest=$2
  if command -v rsync >/dev/null 2>&1; then
    rsync -avz -e "$RSYNC_SSH" "$src/" "$SSH_TARGET:$dest/"
  else
    scp -r "${SSH_OPTIONS[@]}" "$src" "$SSH_TARGET:$dest"
  fi
}

echo "Ensuring remote path $REMOTE_PATH exists..."
ssh_command "mkdir -p '$REMOTE_PATH'"
ssh_command "mkdir -p '$REMOTE_PATH/data/nginx'"

echo "Uploading $ENV_FILE to $REMOTE_PATH/.env..."
ensure_remote_path_not_directory ".env"
transfer_file "$ENV_FILE" "$REMOTE_PATH/.env"

echo "Uploading nginx config from $NGINX_DIR to $REMOTE_PATH/data/nginx/..."
while IFS= read -r file_path; do
  rel_path=${file_path#"$NGINX_DIR"/}
  ensure_remote_path_not_directory "data/nginx/$rel_path"
done < <(find "$NGINX_DIR" -type f)
transfer_directory "$NGINX_DIR" "$REMOTE_PATH/data/nginx"

echo "Uploading compose file $LOCAL_COMPOSE_FILE to $REMOTE_PATH/docker-compose.yml..."
ensure_remote_path_not_directory "docker-compose.yml"
transfer_file "$LOCAL_COMPOSE_FILE" "$REMOTE_PATH/docker-compose.yml"

echo "Pulling Docker images..."
ssh_command "cd '$REMOTE_PATH' && docker compose pull"

echo "Stopping existing services..."
ssh_command "cd '$REMOTE_PATH' && docker compose down"

echo "Starting Docker services..."
ssh_command "cd '$REMOTE_PATH' && docker compose up -d --remove-orphans"

echo "Deployment complete."
