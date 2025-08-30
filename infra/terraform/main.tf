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

  # Only external services (exclude internal ones)
  external_services = {
    for k, v in var.services : k => v
    if !try(v.internal, false)
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

# Cloud Run services
resource "google_cloud_run_v2_service" "services" {
  for_each = var.services

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
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${data.google_artifact_registry_repository.repo.repository_id}/${each.value.name}:${var.image_version}"

      ports {
        container_port = each.value.port
      }

      resources {
        limits = {
          cpu    = each.value.cpu
          memory = each.value.memory
        }
      }

      dynamic "env" {
        for_each = merge(each.value.env_vars, {
          DATABASE_URL = "postgresql://${google_sql_user.user.name}:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/${google_sql_database.database.name}"
          REDIS_URL    = "redis://${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
        })
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
  name            = "mud-url-map"
  default_service = google_compute_backend_service.services["dm"].id

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
  for_each = var.services

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
  for_each = local.external_services

  name = "${each.value.name}.${data.google_dns_managed_zone.zone.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.zone.name

  rrdatas = [google_compute_global_address.default.address]
}
