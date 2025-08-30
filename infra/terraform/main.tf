# Enable required APIs
# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sql-component.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "dns.googleapis.com",
    "certificatemanager.googleapis.com",
    "compute.googleapis.com",
    "container.googleapis.com",
    "containerregistry.googleapis.com",
    "artifactregistry.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

# Local values for filtering services
locals {
  # All services
  all_services = var.services

  # Only enabled services
  enabled_services = {
    for k, v in var.services : k => v
    if try(coalesce(v.enabled, true), true)
  }

  # Only external services (exclude internal ones)
  external_services = {
    for k, v in local.enabled_services : k => v
    if !try(coalesce(v.internal, false), false)
  }
}

# VPC Network for private services
resource "google_compute_network" "vpc" {
  name                    = "mud-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "subnet" {
  name          = "mud-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true
}

# VPC Connector for Cloud Run to access private services
resource "google_vpc_access_connector" "connector" {
  name          = "mud-connector"
  region        = var.region
  network       = google_compute_network.vpc.name
  ip_cidr_range = "10.8.0.0/28"

  depends_on = [google_project_service.apis]
}

# Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "postgres" {
  name             = "mud-postgres"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = var.db_tier

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = false
  depends_on          = [google_project_service.apis, google_service_networking_connection.private_vpc_connection]
}

# Database
resource "google_sql_database" "database" {
  name     = "mud_dev"
  instance = google_sql_database_instance.postgres.name
}

# Database user
resource "google_sql_user" "user" {
  name     = "mud"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# Private service networking for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "private-ip-address"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Redis instance
resource "google_redis_instance" "redis" {
  name           = "mud-redis"
  tier           = "BASIC"
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region

  authorized_network = google_compute_network.vpc.id

  redis_version = "REDIS_7_0"
  display_name  = "MUD Redis Instance"

  depends_on = [google_project_service.apis]
}

# Reference existing Artifact Registry repository
data "google_artifact_registry_repository" "repo" {
  repository_id = "mud-registry"
  location      = var.region
}

# Project data to obtain project number for default compute service account
data "google_project" "project" {}

# Secret Manager: OpenAI API key
resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "openai-api-key"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "openai_api_key" {
  count       = var.openai_api_key == null ? 0 : 1
  secret      = google_secret_manager_secret.openai_api_key.id
  secret_data = var.openai_api_key
}

# Allow Cloud Run's default compute service account to access the secret
resource "google_secret_manager_secret_iam_binding" "openai_accessor" {
  secret_id = google_secret_manager_secret.openai_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  members = [
    "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  ]
}

# Slack secrets
resource "google_secret_manager_secret" "slack_bot_token" {
  secret_id = "slack-bot-token"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "slack_signing_secret" {
  secret_id = "slack-signing-secret"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "slack_app_token" {
  secret_id = "slack-app-token"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "slack_bot_token" {
  count       = var.slack_bot_token == null ? 0 : 1
  secret      = google_secret_manager_secret.slack_bot_token.id
  secret_data = var.slack_bot_token
}

resource "google_secret_manager_secret_version" "slack_signing_secret" {
  count       = var.slack_signing_secret == null ? 0 : 1
  secret      = google_secret_manager_secret.slack_signing_secret.id
  secret_data = var.slack_signing_secret
}

resource "google_secret_manager_secret_version" "slack_app_token" {
  count       = var.slack_app_token == null ? 0 : 1
  secret      = google_secret_manager_secret.slack_app_token.id
  secret_data = var.slack_app_token
}

resource "google_secret_manager_secret_iam_binding" "slack_bot_token_accessor" {
  secret_id = google_secret_manager_secret.slack_bot_token.id
  role      = "roles/secretmanager.secretAccessor"
  members = [
    "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  ]
}

resource "google_secret_manager_secret_iam_binding" "slack_signing_secret_accessor" {
  secret_id = google_secret_manager_secret.slack_signing_secret.id
  role      = "roles/secretmanager.secretAccessor"
  members = [
    "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  ]
}

resource "google_secret_manager_secret_iam_binding" "slack_app_token_accessor" {
  secret_id = google_secret_manager_secret.slack_app_token.id
  role      = "roles/secretmanager.secretAccessor"
  members = [
    "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  ]
}

# Cloud Run services
resource "google_cloud_run_v2_service" "services" {
  for_each = local.enabled_services

  name     = "mud-${each.value.name}"
  location = var.region

  template {
    scaling {
      min_instance_count = each.value.min_scale
      max_instance_count = each.value.max_scale
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      # Compute the image name, allowing an override when provided
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${data.google_artifact_registry_repository.repo.repository_id}/${lookup(var.image_name_overrides, each.key, each.value.name)}:${var.image_version}"

      ports {
        container_port = each.value.port
      }

      resources {
        # Allow CPU throttling so <1 CPU (e.g., 500m) is supported
        cpu_idle = true
        limits = {
          cpu    = each.value.cpu
          memory = each.value.memory
        }
      }

      # Give containers ample time to start and begin listening on the port
      # This helps services that initialize DB connections or other dependencies on startup
      startup_probe {
        tcp_socket {
          port = each.value.port
        }
        initial_delay_seconds = 0
        period_seconds        = 10
        timeout_seconds       = 300
        failure_threshold     = 30
      }

      # Plain env vars (exclude secret keys such as OPENAI_API_KEY)
      dynamic "env" {
        for_each = {
          for k, v in merge(each.value.env_vars, {
            DATABASE_URL = "postgresql://${google_sql_user.user.name}:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/${google_sql_database.database.name}"
            REDIS_URL    = "redis://${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
          }) : k => v if k != "OPENAI_API_KEY"
        }
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secret-backed env var for dm
      dynamic "env" {
        for_each = contains(["dm"], each.key) ? { OPENAI_API_KEY = "from-secret" } : {}
        content {
          name = "OPENAI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.openai_api_key.name
              version = "latest"
            }
          }
        }
      }

      # Secret-backed env vars for Slack bot
      dynamic "env" {
        for_each = contains(["slack-bot"], each.key) ? {
          SLACK_BOT_TOKEN      = google_secret_manager_secret.slack_bot_token.name
          SLACK_SIGNING_SECRET = google_secret_manager_secret.slack_signing_secret.name
          SLACK_APP_TOKEN      = google_secret_manager_secret.slack_app_token.name
        } : {}
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      # Set Slack Bot service endpoints via explicit env vars when provided (avoid intra-resource cycles)
      dynamic "env" {
        for_each = contains(["slack-bot"], each.key) ? {
          for k, v in each.value.env_vars : k => v if contains(["DM_GQL_ENDPOINT", "WORLD_GQL_ENDPOINT", "WORLD_BASE_URL"], k)
        } : {}
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  depends_on = [google_project_service.apis]
}

# Cloud Run IAM - Allow unauthenticated access only for external services
resource "google_cloud_run_v2_service_iam_binding" "public" {
  for_each = local.external_services

  name     = google_cloud_run_v2_service.services[each.key].name
  location = google_cloud_run_v2_service.services[each.key].location
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}

# Allow internal services to be invoked by the default compute SA (used by other services)
resource "google_cloud_run_v2_service_iam_binding" "internal_invoker" {
  for_each = { for k, v in local.enabled_services : k => v if try(coalesce(v.internal, false), false) }

  name     = google_cloud_run_v2_service.services[each.key].name
  location = google_cloud_run_v2_service.services[each.key].location
  role     = "roles/run.invoker"
  members  = [
    "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  ]
}

# Get existing DNS zone
data "google_dns_managed_zone" "zone" {
  name = var.dns_zone_name
}

# SSL Certificate
resource "google_compute_managed_ssl_certificate" "ssl_cert" {
  name = "mud-ssl-cert"

  managed {
    domains = [
      for service_key, service in local.external_services : "${service.name}.${var.domain}"
    ]
  }

  depends_on = [google_project_service.apis]
}

# Global Load Balancer
resource "google_compute_global_address" "default" {
  name = "mud-lb-ip"
}

# URL Map
resource "google_compute_url_map" "default" {
  name = "mud-url-map"
  # Use the first available external backend service as the default. Assumes at least one external service exists.
  default_service = values(google_compute_backend_service.services)[0].id

  dynamic "host_rule" {
    for_each = local.external_services
    content {
      hosts        = ["${host_rule.value.name}.${var.domain}"]
      path_matcher = "path-matcher-${host_rule.value.name}"
    }
  }

  dynamic "path_matcher" {
    for_each = local.external_services
    content {
      name            = "path-matcher-${path_matcher.value.name}"
      default_service = google_compute_backend_service.services[path_matcher.key].id
    }
  }
}

# Backend services for Cloud Run (external services only)
resource "google_compute_backend_service" "services" {
  for_each = local.external_services

  name        = "mud-${each.value.name}-backend"
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.services[each.key].id
  }
}

# Network Endpoint Groups for Cloud Run services
resource "google_compute_region_network_endpoint_group" "services" {
  for_each = local.enabled_services

  name                  = "mud-${each.value.name}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.services[each.key].name
  }
}

# HTTPS Proxy
resource "google_compute_target_https_proxy" "default" {
  name    = "mud-https-proxy"
  url_map = google_compute_url_map.default.id
  ssl_certificates = [
    google_compute_managed_ssl_certificate.ssl_cert.id
  ]
}

# HTTP to HTTPS redirect
resource "google_compute_url_map" "https_redirect" {
  name = "mud-https-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "https_redirect" {
  name    = "mud-http-proxy"
  url_map = google_compute_url_map.https_redirect.id
}

# Global forwarding rules
resource "google_compute_global_forwarding_rule" "https" {
  name       = "mud-https-forwarding-rule"
  target     = google_compute_target_https_proxy.default.id
  port_range = "443"
  ip_address = google_compute_global_address.default.address
}

resource "google_compute_global_forwarding_rule" "http" {
  name       = "mud-http-forwarding-rule"
  target     = google_compute_target_http_proxy.https_redirect.id
  port_range = "80"
  ip_address = google_compute_global_address.default.address
}

# DNS records
resource "google_dns_record_set" "services" {
  # Skip DNS A record creation for services marked in dns_skip to avoid conflicts with existing CNAMEs
  for_each = { for k, v in local.external_services : k => v if !contains(var.dns_skip, k) }

  name = "${each.value.name}.${data.google_dns_managed_zone.zone.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.zone.name

  rrdatas = [google_compute_global_address.default.address]
}
