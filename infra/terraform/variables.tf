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
    # Optional: fully qualified container image to deploy (overrides computed Artifact Registry image)
    # Example: "us-central1-docker.pkg.dev/my-proj/my-repo/dm:abc123" or "gcr.io/my-proj/custom:tag"
    image = optional(string)
  }))
}

variable "service_image_overrides" {
  description = "Optional map of explicit container image references per service. When provided, these values take precedence over computed image tags."
  type        = map(string)
  default     = {}
}

variable "image_version" {
  description = "The version tag for Docker images"
  type        = string
  default     = "latest"
}

# Optional: Git commit SHA for Datadog metadata.
# When provided (e.g., via TF_VAR_git_commit_sha), Terraform will set
# DD_GIT_COMMIT_SHA on Cloud Run services. This is optional because
# deploys also update this via gcloud in CI.
variable "git_commit_sha" {
  description = "Git commit SHA to set as DD_GIT_COMMIT_SHA (optional)"
  type        = string
  default     = null
}

# Toggle to enable or disable the external HTTPS Load Balancer stack.
# When false, all LB-related resources (IP, forwarding rules, proxies, URL maps,
# backend services, NEGs, and DNS A records) are not created.
variable "enable_load_balancer" {
  description = "Enable the external HTTPS Load Balancer (set false when using Cloud Run Domain Mapping only)"
  type        = bool
  default     = false
}

# Optional: Provide the OpenAI API key securely via TF_VAR_openai_api_key (recommended)
variable "openai_api_key" {
  description = "OpenAI API key secret value (optional). If unset, create the secret without a version and set it manually)."
  type        = string
  default     = null
  sensitive   = true
}

# Datadog API key (optional)
variable "datadog_api_key" {
  description = "Datadog API key (optional). Provide via TF_VAR_datadog_api_key in CI."
  type        = string
  default     = null
  sensitive   = true
}

# Datadog site (e.g., datadoghq.com, datadoghq.eu)
variable "datadog_site" {
  description = "Datadog site domain for agentless APM and other endpoints"
  type        = string
  default     = "datadoghq.com"
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

variable "github_repository" {
  description = "GitHub repository (OWNER/REPO) that is allowed to access Workload Identity Federation. Leave null to skip creation."
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
