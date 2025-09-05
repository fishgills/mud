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
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${data.google_artifact_registry_repository.repo.repository_id}/${each.value.name}:${var.image_version}"

      ports {
        container_port = each.value.port
      }

      resources {
        cpu_idle = true
        limits = {
          cpu    = each.value.cpu
          memory = each.value.memory
        }
      }

      startup_probe {
        tcp_socket {
          port = each.value.port
        }
        initial_delay_seconds = 0
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 30
      }

      # Inject a deploy stamp to force a new revision whenever the image tag changes
      env {
        name  = "DEPLOY_STAMP"
        value = var.image_version
      }

      dynamic "env" {
        for_each = {
          for k, v in merge(each.value.env_vars, {
            DATABASE_URL = "postgresql://${google_sql_user.user.name}:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/${google_sql_database.database.name}"
            REDIS_URL    = "redis://${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
            # Signal that this service is running in Google Cloud Run
            GCP_CLOUD_RUN  = "true"
            GCP_PROJECT_ID = var.project_id
            GCP_REGION     = var.region
          }) : k => v if k != "OPENAI_API_KEY"
        }
        content {
          name  = env.key
          value = env.value
        }
      }

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

      dynamic "env" {
        for_each = contains(["slack-bot"], each.key) ? {
          for k, v in each.value.env_vars : k => v if contains(["DM_GQL_ENDPOINT", "WORLD_GQL_ENDPOINT", "WORLD_BASE_URL"], k)
        } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      # Auto-inject WORLD_SERVICE_URL for DM if not provided, pointing to the World service base path (/world)
      dynamic "env" {
        for_each = contains(["dm"], each.key) && !contains(keys(try(each.value.env_vars, {})), "WORLD_SERVICE_URL") ? {
          WORLD_SERVICE_URL = "https://mud-world-${data.google_project.project.number}.${var.region}.run.app"
        } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      # Feature flag for Vertex AI usage in DM
      dynamic "env" {
        for_each = contains(["dm"], each.key) ? { DM_USE_VERTEX_AI = tostring(try(each.value.env_vars.DM_USE_VERTEX_AI, false)) } : {}
        content {
          name  = "DM_USE_VERTEX_AI"
          value = env.value
        }
      }

      # Optional: pass through Vertex model/location overrides if provided in env_vars
      dynamic "env" {
        for_each = contains(["dm"], each.key) ? {
          for k, v in try(each.value.env_vars, {}) : k => v if contains(["VERTEX_LOCATION"], k)
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

# Cloud Run IAM
resource "google_cloud_run_v2_service_iam_binding" "public" {
  for_each = local.external_services

  name     = google_cloud_run_v2_service.services[each.key].name
  location = google_cloud_run_v2_service.services[each.key].location
  role     = "roles/run.invoker"
  members  = ["allUsers"]
}

resource "google_cloud_run_v2_service_iam_binding" "internal_invoker" {
  for_each = { for k, v in local.enabled_services : k => v if try(coalesce(v.internal, false), false) }

  name     = google_cloud_run_v2_service.services[each.key].name
  location = google_cloud_run_v2_service.services[each.key].location
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
  ]
}
