variable "project_id" {
  description = "The Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Region where shared resources (GKE, Redis, Cloud SQL) are provisioned."
  type        = string
}

variable "gke_zone" {
  description = "Optional zone override for the GKE cluster. Defaults to <region>-a when unset."
  type        = string
  default     = null
}

variable "environment" {
  description = "Label appended to resource names (for example prod, staging)."
  type        = string
  default     = "prod"
}

variable "domain" {
  description = "Primary domain used for public endpoints."
  type        = string
  default     = "battleforge.app"
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

variable "redis_instance_name" {
  description = "Memorystore (Redis) instance name."
  type        = string
  default     = "mud-cache"
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
