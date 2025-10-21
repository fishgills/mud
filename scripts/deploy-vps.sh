#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <host> <user> <remote_path> [env_file=.env.prod] [nginx_dir=data/nginx] [ssh_key=${HOME}/.ssh/mud-vps] [gcloud_instance=mud-vps] [gcp_project=battleforge-444008] [compose_file=docker-compose.prod.yml]" >&2
  exit 1
fi

HOST=$1
USER=$2
REMOTE_PATH=$3
ENV_FILE=${4:-.env.prod}
NGINX_DIR=${5:-data/nginx}
DEFAULT_SSH_KEY="${HOME}/.ssh/mud-vps"
DEFAULT_INSTANCE="mud-vps"
DEFAULT_PROJECT="battleforge-444008"
SSH_KEY=${6:-${DEFAULT_SSH_KEY}}
GCLOUD_INSTANCE=${7:-${DEPLOY_INSTANCE:-$DEFAULT_INSTANCE}}
GCP_PROJECT=${8:-${GCP_PROJECT:-$DEFAULT_PROJECT}}
COMPOSE_FILE_NAME=${9:-docker-compose.prod.yml}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -d "$NGINX_DIR" ]]; then
  echo "Missing nginx config directory: $NGINX_DIR" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE_NAME" ]]; then
  echo "Missing compose file: $COMPOSE_FILE_NAME" >&2
  exit 1
fi

SSH_HOST="$HOST"
SSH_TARGET="${USER}@${SSH_HOST}"
SSH_OPTIONS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10)
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTIONS+=(-i "$SSH_KEY")
fi

if [[ ! -f "$SSH_KEY" ]]; then
  echo "Missing SSH key: $SSH_KEY" >&2
  exit 1
fi

if [[ -n "$GCLOUD_INSTANCE" ]]; then
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
      SSH_TARGET="${USER}@${SSH_HOST}"
      echo "Using IP ${SSH_HOST} for SSH connections."
    else
      echo "WARNING: gcloud did not return an external IP for instance ${GCLOUD_INSTANCE}; falling back to host ${HOST}." >&2
    fi
  else
    echo "WARNING: gcloud CLI not found; cannot resolve instance ${GCLOUD_INSTANCE}, using host ${HOST}." >&2
  fi
fi

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

echo "Uploading compose file $COMPOSE_FILE_NAME to $REMOTE_PATH/$COMPOSE_FILE_NAME..."
ensure_remote_path_not_directory "$COMPOSE_FILE_NAME"
transfer_file "$COMPOSE_FILE_NAME" "$REMOTE_PATH/$COMPOSE_FILE_NAME"

echo "Pulling Docker images..."
ssh_command "cd '$REMOTE_PATH' && COMPOSE_FILE='$COMPOSE_FILE_NAME' docker compose pull"

echo "Starting Docker services..."
ssh_command "cd '$REMOTE_PATH' && COMPOSE_FILE='$COMPOSE_FILE_NAME' docker compose up -d"

echo "Deployment complete."
