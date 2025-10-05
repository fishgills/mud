#!/bin/bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <project_id> <region>" >&2
  exit 1
fi

PROJECT_ID="$1"
REGION="$2"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required to run this script" >&2
  exit 1
fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)' 2>/dev/null || true)
if [ -z "$PROJECT_NUMBER" ]; then
  echo "Failed to resolve project number for $PROJECT_ID" >&2
  exit 1
fi

log() {
  printf '[sync-env] %s\n' "$*"
}

join_path() {
  local base="${1%/}"
  local suffix="${2#/}"
  printf '%s/%s' "$base" "$suffix"
}

normalize_url() {
  local value="$1"
  # Trim trailing slash but leave path components intact
  value="${value%/}"
  printf '%s' "$value"
}

value_matches() {
  local candidate="$(normalize_url "$1")"
  shift
  local target
  for target in "$@"; do
    if [ "$candidate" = "$(normalize_url "$target")" ]; then
      return 0
    fi
  done
  return 1
}

service_alias_url() {
  local service_name="$1"
  printf 'https://%s-%s.%s.run.app' "$service_name" "$PROJECT_NUMBER" "$REGION"
}

declare -A SERVICE_URLS
declare -A SERVICE_ENVS
declare -A SERVICE_INFO_LOADED

declare -A SERVICE_REMOVE
declare -A SERVICE_UPDATE

load_service_info() {
  local service_name="$1"
  if [ "${SERVICE_INFO_LOADED[$service_name]:-}" = "1" ]; then
    return 0
  fi

  local service_json
  if ! service_json=$(gcloud run services describe "$service_name" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --platform managed \
    --format=json 2>/dev/null); then
    log "Warning: unable to describe ${service_name}"
    SERVICE_URLS[$service_name]=''
    SERVICE_ENVS[$service_name]='[]'
    SERVICE_INFO_LOADED[$service_name]='1'
    return 0
  fi

  SERVICE_URLS[$service_name]="$(jq -r '.status.url // empty' <<<"$service_json")"
  SERVICE_ENVS[$service_name]="$(jq -c '(.template.containers[0].env // .spec.template.spec.containers[0].env // [])' <<<"$service_json")"
  SERVICE_INFO_LOADED[$service_name]='1'
  return 0
}

service_url() {
  local service_name="$1"
  load_service_info "$service_name"
  printf '%s' "${SERVICE_URLS[$service_name]:-}"
}

env_values() {
  local service_name="$1"
  local key="$2"
  load_service_info "$service_name"
  local env_json="${SERVICE_ENVS[$service_name]:-[]}"
  jq -r --arg key "$key" '
    map(select(.name == $key))
    | map(select(has("value")) | .value)
    | .[]
  ' <<<"$env_json"
}

add_remove() {
  local service_name="$1"
  local key="$2"
  local current="${SERVICE_REMOVE[$service_name]:-}"
  if [ -z "$current" ]; then
    SERVICE_REMOVE[$service_name]="$key"
    return
  fi
  if [[ ",$current," == *",$key,"* ]]; then
    return
  fi
  SERVICE_REMOVE[$service_name]+=",$key"
}

add_update() {
  local service_name="$1"
  local pair="$2"
  local current="${SERVICE_UPDATE[$service_name]:-}"
  if [ -z "$current" ]; then
    SERVICE_UPDATE[$service_name]="$pair"
    return
  fi
  SERVICE_UPDATE[$service_name]+=",$pair"
}

ensure_service_env() {
  local service_name="$1"
  local key="$2"
  local desired="$3"
  shift 3
  local acceptable=("$desired" "$@")

  mapfile -t current < <(env_values "$service_name" "$key")

  local need_update=0
  local reason=""

  if [ "${#current[@]}" -eq 0 ]; then
    need_update=1
    reason="not set"
  else
    local matched=0
    local value
    local -A unique_values=()
    for value in "${current[@]}"; do
      local normalized="$(normalize_url "$value")"
      unique_values["$normalized"]=1
      if value_matches "$value" "${acceptable[@]}"; then
        matched=$((matched + 1))
      else
        need_update=1
        reason="unexpected value(s): ${current[*]}"
      fi
    done

    if [ ${#unique_values[@]} -gt 1 ]; then
      need_update=1
      reason="multiple distinct values: ${current[*]}"
    fi

    if [ ${#current[@]} -gt 1 ]; then
      need_update=1
      reason="duplicate entries: ${current[*]}"
    fi

    if [ $matched -eq 0 ]; then
      need_update=1
      reason="no acceptable value present"
    fi

    if [ $need_update -eq 0 ] && ! value_matches "${current[0]}" "$desired"; then
      # Value is acceptable, but not equal to desired; keep existing to avoid unnecessary revisions
      log "No change for ${service_name} ${key} (kept existing acceptable value)"
      return
    fi
  fi

  if [ $need_update -eq 0 ]; then
    log "No change for ${service_name} ${key}"
    return
  fi

  log "Setting ${service_name} ${key} -> ${desired}${reason:+ (reason: $reason)}"
  add_remove "$service_name" "$key"
  add_update "$service_name" "${key}=${desired}"
}

select_world_base_value() {
  local service_name="$1"
  local world_url="$2"
  local world_alias="$3"

  mapfile -t values < <(env_values "$service_name" "WORLD_BASE_URL")

  local val
  for val in "${values[@]}"; do
    if [ -n "$val" ] && [[ "$val" != https://mud-world-* ]]; then
      printf '%s' "$val"
      return
    fi
  done

  if [ ${#values[@]} -gt 0 ]; then
    printf '%s' "${values[0]}"
    return
  fi

  if [ -n "$world_url" ]; then
    printf '%s' "$(join_path "$world_url" 'world')"
    return
  fi

  if [ -n "$world_alias" ]; then
    printf '%s' "$(join_path "$world_alias" 'world')"
    return
  fi

  printf ''
}

apply_updates() {
  local service_name
  for service_name in "$@"; do
    local remove_list="${SERVICE_REMOVE[$service_name]:-}"
    local update_list="${SERVICE_UPDATE[$service_name]:-}"

    if [ -z "$remove_list" ] && [ -z "$update_list" ]; then
      log "No environment changes required for ${service_name}"
      continue
    fi

    log "Applying environment updates for ${service_name}" \
      "${remove_list:+(remove: $remove_list)}" \
      "${update_list:+(set: $update_list)}"

    local cmd=(
      gcloud run services update "$service_name"
      --project "$PROJECT_ID"
      --region "$REGION"
      --platform managed
      --quiet
    )

    if [ -n "$remove_list" ]; then
      cmd+=(--remove-env-vars "$remove_list")
    fi
    if [ -n "$update_list" ]; then
      cmd+=(--update-env-vars "$update_list")
    fi

    "${cmd[@]}"
  done
}

SERVICE_DM="mud-dm"
SERVICE_WORLD="mud-world"
SERVICE_SLACK="mud-slack-bot"
SERVICE_TICK="mud-tick"

log "Resolving Cloud Run service URLs in ${REGION} (${PROJECT_ID})"

for service in "$SERVICE_DM" "$SERVICE_WORLD" "$SERVICE_SLACK" "$SERVICE_TICK"; do
  load_service_info "$service"
  url="${SERVICE_URLS[$service]:-}"
  if [ -z "$url" ]; then
    log "Warning: unable to resolve URL for ${service}"
  else
    log "Found URL for ${service}: ${url}"
  fi
done

world_url="$(service_url "$SERVICE_WORLD")"
dm_url="$(service_url "$SERVICE_DM")"

world_alias="$(service_alias_url "$SERVICE_WORLD")"
dm_alias="$(service_alias_url "$SERVICE_DM")"

if [ -n "$world_url" ]; then
  ensure_service_env "$SERVICE_DM" "WORLD_SERVICE_URL" "${world_url%/}" "${world_alias%/}"
fi

if [ -n "$dm_url" ]; then
  ensure_service_env "$SERVICE_TICK" "DM_GRAPHQL_URL" "$(join_path "$dm_url" 'graphql')" "$(join_path "$dm_alias" 'graphql')"
  ensure_service_env "$SERVICE_SLACK" "DM_GQL_ENDPOINT" "$(join_path "$dm_url" 'graphql')" "$(join_path "$dm_alias" 'graphql')"
fi

if [ -n "$world_url" ]; then
  ensure_service_env "$SERVICE_SLACK" "WORLD_GQL_ENDPOINT" "$(join_path "$world_url" 'graphql')" "$(join_path "$world_alias" 'graphql')"
fi

desired_world_base="$(select_world_base_value "$SERVICE_SLACK" "$world_url" "$world_alias")"

if [ -n "$desired_world_base" ]; then
  local_world_base_url=""
  local_world_alias_url=""
  if [ -n "$world_url" ]; then
    local_world_base_url="$(join_path "$world_url" 'world')"
  fi
  if [ -n "$world_alias" ]; then
    local_world_alias_url="$(join_path "$world_alias" 'world')"
  fi

  world_base_acceptables=()
  if [ -n "$local_world_base_url" ] && [ "$local_world_base_url" != "$desired_world_base" ]; then
    world_base_acceptables+=("$local_world_base_url")
  fi
  if [ -n "$local_world_alias_url" ] && [ "$local_world_alias_url" != "$desired_world_base" ]; then
    world_base_acceptables+=("$local_world_alias_url")
  fi

  ensure_service_env "$SERVICE_SLACK" "WORLD_BASE_URL" "$desired_world_base" "${world_base_acceptables[@]}"
fi

apply_updates "$SERVICE_DM" "$SERVICE_TICK" "$SERVICE_SLACK"

log "Completed Cloud Run env var sync"
