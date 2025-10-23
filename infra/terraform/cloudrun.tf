resource "google_cloud_run_service" "world" {
  name     = local.service_names.world
  location = var.region

  template {
    metadata {
      annotations = {
        "run.googleapis.com/ingress"              = "all"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.serverless.id
        "run.googleapis.com/vpc-access-egress"    = "all-traffic"
        "run.googleapis.com/cloudsql-instances"   = google_sql_database_instance.postgres.connection_name
      }
      labels = {
        environment = var.environment
        service     = "world"
      }
    }

    spec {
      service_account_name  = google_service_account.runtime["world"].email
      container_concurrency = 40
      timeout_seconds       = 600

      containers {
        image = local.images.world

        ports {
          name           = "http1"
          container_port = 8080
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name  = "PORT"
          value = "8080"
        }

        env {
          name  = "GCP_CLOUD_RUN"
          value = "true"
        }

        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.database_url.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name  = "REDIS_URL"
          value = "redis://${google_redis_instance.cache.host}:6379"
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.apis,
    google_secret_manager_secret_version.database_url,
    google_redis_instance.cache
  ]
}

resource "google_cloud_run_service" "dm" {
  name     = local.service_names.dm
  location = var.region

  template {
    metadata {
      annotations = {
        "run.googleapis.com/ingress"              = "all"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.serverless.id
        "run.googleapis.com/vpc-access-egress"    = "all-traffic"
        "run.googleapis.com/cloudsql-instances"   = google_sql_database_instance.postgres.connection_name
      }
      labels = {
        environment = var.environment
        service     = "dm"
      }
    }

    spec {
      service_account_name  = google_service_account.runtime["dm"].email
      container_concurrency = 20
      timeout_seconds       = 600

      containers {
        image = local.images.dm

        ports {
          name           = "http1"
          container_port = 8080
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        env {
          name  = "PORT"
          value = "8080"
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }

        env {
          name  = "GCP_REGION"
          value = var.region
        }

        env {
          name  = "GCP_CLOUD_RUN"
          value = "true"
        }

        env {
          name  = "DM_USE_VERTEX_AI"
          value = "true"
        }

        env {
          name = "OPENAI_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.provided["openai"].secret_id
              key  = "latest"
            }
          }
        }

        env {
          name  = "REDIS_URL"
          value = "redis://${google_redis_instance.cache.host}:6379"
        }

        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.database_url.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name  = "WORLD_SERVICE_URL"
          value = "${google_cloud_run_service.world.status[0].url}/world"
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_cloud_run_service.world,
    google_secret_manager_secret_version.provided,
    google_secret_manager_secret_version.database_url,
    google_redis_instance.cache
  ]
}

resource "google_cloud_run_service" "slack_bot" {
  name     = local.service_names.slack_bot
  location = var.region

  template {
    metadata {
      annotations = {
        "run.googleapis.com/ingress"              = "all"
        "run.googleapis.com/vpc-access-connector" = google_vpc_access_connector.serverless.id
        "run.googleapis.com/vpc-access-egress"    = "all-traffic"
        "run.googleapis.com/cloudsql-instances"   = google_sql_database_instance.postgres.connection_name
      }
      labels = {
        environment = var.environment
        service     = "slack-bot"
      }
    }

    spec {
      service_account_name  = google_service_account.runtime["slack_bot"].email
      container_concurrency = 10
      timeout_seconds       = 300

      containers {
        image = local.images.slack_bot

        ports {
          name           = "http1"
          container_port = 8080
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name  = "PORT"
          value = "8080"
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name  = "GCP_CLOUD_RUN"
          value = "true"
        }

        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.database_url.secret_id
              key  = "latest"
            }
          }
        }

        env {
          name  = "REDIS_URL"
          value = "redis://${google_redis_instance.cache.host}:6379"
        }

        env {
          name  = "DM_API_BASE_URL"
          value = google_cloud_run_service.dm.status[0].url
        }

        env {
          name  = "WORLD_API_BASE_URL"
          value = "${google_cloud_run_service.world.status[0].url}/world"
        }

        env {
          name = "SLACK_BOT_TOKEN"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.provided["slack_bot_token"].secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SLACK_SIGNING_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.provided["slack_signing_secret"].secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SLACK_APP_TOKEN"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.provided["slack_app_token"].secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SLACK_CLIENT_ID"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.provided["slack_client_id"].secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SLACK_CLIENT_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.provided["slack_client_secret"].secret_id
              key  = "latest"
            }
          }
        }

        env {
          name = "SLACK_STATE_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.provided["slack_state_secret"].secret_id
              key  = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_cloud_run_service.dm,
    google_secret_manager_secret_version.provided,
    google_secret_manager_secret_version.database_url,
    google_redis_instance.cache
  ]
}

resource "google_cloud_run_service" "tick" {
  name     = local.service_names.tick
  location = var.region

  template {
    metadata {
      annotations = {
        "run.googleapis.com/ingress"           = "internal"
        "autoscaling.knative.dev/minScale"     = "1"
        "autoscaling.knative.dev/maxScale"     = "1"
        "run.googleapis.com/cpu-throttling"    = "false"
        "run.googleapis.com/startup-cpu-boost" = "true"
      }
      labels = {
        environment = var.environment
        service     = "tick"
      }
    }

    spec {
      service_account_name  = google_service_account.runtime["tick"].email
      container_concurrency = 1
      timeout_seconds       = 3600

      containers {
        image = local.images.tick

        ports {
          name           = "http1"
          container_port = 8080
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name  = "PORT"
          value = "8080"
        }

        env {
          name  = "NODE_ENV"
          value = "production"
        }

        env {
          name  = "GCP_CLOUD_RUN"
          value = "true"
        }

        env {
          name  = "DM_API_BASE_URL"
          value = google_cloud_run_service.dm.status[0].url
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_cloud_run_service.dm
  ]
}

resource "google_cloud_run_service_iam_member" "public_invoker" {
  for_each = {
    slack_bot = google_cloud_run_service.slack_bot.name
    world     = google_cloud_run_service.world.name
  }

  location = var.region
  project  = var.project_id
  service  = each.value
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_domain_mapping" "public" {
  provider = google-beta

  for_each = {
    slack_bot = {
      hostname = local.domain_mappings.slack_bot
      service  = google_cloud_run_service.slack_bot.name
    }
    world = {
      hostname = local.domain_mappings.world
      service  = google_cloud_run_service.world.name
    }
  }

  location = var.region
  name     = each.value.hostname

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = each.value.service
  }
}

resource "google_dns_record_set" "cloud_run_domains" {
  for_each = {
    slack_bot = local.domain_mappings.slack_bot
    world     = local.domain_mappings.world
  }

  name         = "${each.value}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "CNAME"
  ttl          = 300

  rrdatas = ["ghs.googlehosted.com."]
}
