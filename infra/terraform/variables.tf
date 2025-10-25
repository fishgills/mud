variable "project_id" {
  description = "The Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Region to deploy shared resources (GKE, Redis, Cloud SQL)."
  type        = string
}

variable "gke_zone" {
  description = "Optional zone override for the GKE cluster. Defaults to <region>-a when unset."
  type        = string
  default     = null
}

variable "gke_machine_type" {
  description = "Machine type for the primary GKE node pool."
  type        = string
  default     = "e2-standard-2"
}

variable "gke_min_node_count" {
  description = "Minimum number of nodes for the primary GKE node pool."
  type        = number
  default     = 1
}

variable "gke_max_node_count" {
  description = "Maximum number of nodes for the primary GKE node pool."
  type        = number
  default     = 3
}

variable "gke_node_disk_size_gb" {
  description = "Disk size in GB for each node in the primary GKE node pool."
  type        = number
  default     = 50
}

variable "domain" {
  description = "Primary domain used for public endpoints."
  type        = string
  default     = "battleforge.app"
}

variable "dns_zone_name" {
  description = "Existing Cloud DNS managed zone name for the primary domain."
  type        = string
  default     = "battleforge-app"
}

variable "environment" {
  description = "Label appended to resource names (for example prod, staging)."
  type        = string
  default     = "prod"
}

variable "artifact_repo_id" {
  description = "Artifact Registry repository ID used for service images."
  type        = string
  default     = "mud-services"
}

variable "artifact_repo_location" {
  description = "Location for the Artifact Registry repository."
  type        = string
  default     = "us-central1"
}

variable "database_instance_name" {
  description = "Cloud SQL instance name."
  type        = string
  default     = "mud-postgres"
}

variable "database_version" {
  description = "PostgreSQL version for Cloud SQL."
  type        = string
  default     = "POSTGRES_15"
}

variable "database_tier" {
  description = "Machine tier for Cloud SQL."
  type        = string
  default     = "db-f1-micro"
}

variable "database_name" {
  description = "Default database name for application services."
  type        = string
  default     = "mud"
}

variable "database_user" {
  description = "Primary database user used by application services."
  type        = string
  default     = "mud_app"
}

variable "redis_instance_name" {
  description = "Memorystore (Redis) instance name."
  type        = string
  default     = "mud-cache"
}

variable "redis_tier" {
  description = "Memorystore tier."
  type        = string
  default     = "BASIC"
}

variable "redis_memory_size_gb" {
  description = "Memorystore cache size in GB."
  type        = number
  default     = 1
}

variable "dm_image" {
  description = "Container image for the Dungeon Master (dm) service."
  type        = string
  default     = null
}

variable "world_image" {
  description = "Container image for the world renderer service."
  type        = string
  default     = null
}

variable "slack_bot_image" {
  description = "Container image for the Slack bot service."
  type        = string
  default     = null
}

variable "tick_image" {
  description = "Container image for the tick scheduler service."
  type        = string
  default     = null
}

variable "github_repository" {
  description = "GitHub repository (OWNER/REPO) allowed to assume the deployer Workload Identity."
  type        = string
  default     = null
}

variable "workload_identity_pool_id" {
  description = "Identifier for the Workload Identity Pool used by GitHub Actions."
  type        = string
  default     = "github-actions"
}

variable "workload_identity_provider_id" {
  description = "Identifier for the Workload Identity Provider used by GitHub Actions."
  type        = string
  default     = "github-actions"
}

variable "openai_api_key" {
  description = "OpenAI API key."
  type        = string
  sensitive   = true
}

variable "slack_bot_token" {
  description = "Slack bot token."
  type        = string
  sensitive   = true
}

variable "slack_signing_secret" {
  description = "Slack signing secret."
  type        = string
  sensitive   = true
}

variable "slack_app_token" {
  description = "Slack app-level token."
  type        = string
  sensitive   = true
}

variable "slack_client_id" {
  description = "Slack OAuth client ID."
  type        = string
  sensitive   = true

}

variable "slack_client_secret" {
  description = "Slack OAuth client secret."
  type        = string
  sensitive   = true
}

variable "slack_state_secret" {
  description = "Slack OAuth state secret."
  type        = string
  sensitive   = true
}
