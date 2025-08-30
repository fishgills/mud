variable "project_id" {
  description = "The GCP project ID"
  type        = string
  default     = "battleforge-444008"
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The GCP zone for zonal resources"
  type        = string
  default     = "us-central1-a"
}

variable "domain" {
  description = "The domain name for the application"
  type        = string
  default     = "battleforge.app"
}

variable "dns_zone_name" {
  description = "The name of the existing Cloud DNS zone"
  type        = string
  default     = "battleforge-app"
}

variable "db_password" {
  description = "Password for the PostgreSQL database"
  type        = string
  sensitive   = true
}

variable "redis_memory_size_gb" {
  description = "Memory size for Redis instance in GB"
  type        = number
  default     = 1
}

variable "db_tier" {
  description = "The machine type for Cloud SQL instance"
  type        = string
  default     = "db-f1-micro"
}

variable "services" {
  description = "Map of service configurations"
  type = map(object({
    name      = string
    port      = number
    cpu       = string
    memory    = string
    min_scale = number
    max_scale = number
    env_vars  = map(string)
    # Optional flags
    internal = optional(bool)
    enabled  = optional(bool)
  }))
}

variable "image_name_overrides" {
  description = "Optional overrides for the container image name per service key (e.g., bot -> slack-bot)."
  type        = map(string)
  default     = {}
}

variable "dns_skip" {
  description = "List of service keys to skip managing DNS A records for (useful if a CNAME already exists)."
  type        = set(string)
  default     = []
}

variable "image_version" {
  description = "The version tag for Docker images"
  type        = string
  default     = "latest"
}

# Optional: Provide the OpenAI API key securely via TF_VAR_openai_api_key (recommended)
variable "openai_api_key" {
  description = "OpenAI API key secret value (optional). If unset, create the secret without a version and set it manually)."
  type        = string
  default     = null
  sensitive   = true
}

# Slack secrets (optional)
variable "slack_bot_token" {
  description = "Slack Bot Token (xoxb-...)"
  type        = string
  default     = null
  sensitive   = true
}

variable "slack_signing_secret" {
  description = "Slack Signing Secret"
  type        = string
  default     = null
  sensitive   = true
}

variable "slack_app_token" {
  description = "Slack App Token (xapp-...)"
  type        = string
  default     = null
  sensitive   = true
}
