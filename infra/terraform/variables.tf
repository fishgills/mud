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
  }))
  default = {
    dm = {
      name      = "dm"
      port      = 3000
      cpu       = "1000m"
      memory    = "512Mi"
      min_scale = 0
      max_scale = 10
      internal  = true # Internal service, no external access
      env_vars = {
        NODE_ENV = "production"
      }
    }
    world = {
      name      = "world"
      port      = 3001
      cpu       = "1000m"
      memory    = "512Mi"
      min_scale = 0
      max_scale = 10
      internal  = true # Internal service, no external access
      env_vars = {
        NODE_ENV = "production"
      }
    }
    bot = {
      name      = "slack-bot"
      port      = 3002
      cpu       = "1000m"
      memory    = "256Mi"
      min_scale = 0
      max_scale = 5
      internal  = false # External service, accessible from internet
      env_vars = {
        NODE_ENV = "production"
      }
    }
    tick = {
      name      = "tick"
      port      = 3003
      cpu       = "1000m"
      memory    = "256Mi"
      min_scale = 0
      max_scale = 3
      internal  = true # Internal service, no external access
      env_vars = {
        NODE_ENV = "production"
      }
    }
  }
}

variable "image_version" {
  description = "The version tag for Docker images"
  type        = string
  default     = "latest"
}
