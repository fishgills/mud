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

variable "image_version" {
  description = "The version tag for Docker images"
  type        = string
  default     = "latest"
}

# GitHub Actions Workload Identity Federation
variable "enable_github_actions_workload_identity" {
  description = "Create the Workload Identity Federation pool, provider, and deployer service account for GitHub Actions."
  type        = bool
  default     = false
}

variable "github_actions_owner" {
  description = "GitHub organization or user that owns the repository used for deployments."
  type        = string
  default     = null
  validation {
    condition     = !var.enable_github_actions_workload_identity || (var.github_actions_owner != null && trim(var.github_actions_owner) != "")
    error_message = "Set github_actions_owner when enable_github_actions_workload_identity is true."
  }
}

variable "github_actions_repository" {
  description = "Repository name (without the owner) used for deployments."
  type        = string
  default     = null
  validation {
    condition     = !var.enable_github_actions_workload_identity || (var.github_actions_repository != null && trim(var.github_actions_repository) != "")
    error_message = "Set github_actions_repository when enable_github_actions_workload_identity is true."
  }
}

variable "github_actions_ref" {
  description = "Git ref (branch, tag, or environment) that is allowed to authenticate via Workload Identity Federation."
  type        = string
  default     = "refs/heads/main"
}

variable "github_actions_attribute_condition" {
  description = "Optional CEL condition that further restricts which GitHub workflows can authenticate. Overrides the default repo/ref check when provided."
  type        = string
  default     = null
}

variable "github_actions_workload_identity_pool_id" {
  description = "Identifier for the Workload Identity pool that GitHub Actions uses."
  type        = string
  default     = "github-actions"
}

variable "github_actions_workload_identity_provider_id" {
  description = "Identifier for the Workload Identity provider inside the pool."
  type        = string
  default     = "github"
}

variable "github_actions_service_account_id" {
  description = "Service account ID (without the domain) that GitHub Actions impersonates."
  type        = string
  default     = "github-actions-deployer"
}

variable "github_actions_service_account_roles" {
  description = "Project-level IAM roles to grant to the GitHub Actions deployer service account."
  type        = list(string)
  default = [
    "roles/artifactregistry.writer",
    "roles/cloudsql.admin",
    "roles/compute.networkAdmin",
    "roles/dns.admin",
    "roles/iam.serviceAccountUser",
    "roles/resourcemanager.projectIamAdmin",
    "roles/run.admin",
    "roles/secretmanager.admin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/redis.admin",
    "roles/certificatemanager.admin",
  ]
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
