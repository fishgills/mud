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
  description = "Primary domain name served by the VPS"
  type        = string
  default     = "battleforge.app"
}

variable "dns_zone_name" {
  description = "The name of the existing Cloud DNS zone"
  type        = string
  default     = "battleforge-app"
}

variable "machine_type" {
  description = "Compute Engine machine type for the VPS"
  type        = string
  default     = "e2-standard-2"
}

variable "boot_disk_image" {
  description = "Source image for the VPS boot disk"
  type        = string
  default     = "projects/debian-cloud/global/images/family/debian-12"
}

variable "boot_disk_size_gb" {
  description = "Boot disk size for the VPS"
  type        = number
  default     = 50
}

variable "additional_hostnames" {
  description = "Additional DNS hostnames (subdomains) that should point at the VPS"
  type        = list(string)
  default     = []
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

variable "openai_api_key" {
  description = "OpenAI API key secret value (optional). If unset, create the secret without a version and set it manually)."
  type        = string
  default     = null
  sensitive   = true
}
