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
      # Only route RFC1918/private ranges through the connector so external
      # destinations like Datadog continue to use Cloud Run's public egress
      # (avoids needing Cloud NAT while keeping database traffic private).
      egress = "PRIVATE_RANGES_ONLY"
    }

    # Primary application container
    containers {
      image = coalesce(
        try(each.value.image, null),
        try(var.service_image_overrides[each.key], null),
        "${var.region}-docker.pkg.dev/${var.project_id}/${data.google_artifact_registry_repository.repo.repository_id}/${each.value.name}:${var.image_version}"
      )

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
        value = try(var.service_image_overrides[each.key], var.image_version)
      }

      dynamic "env" {
        for_each = {
          for k, v in merge(
            each.value.env_vars,
            {
              DATABASE_URL = "postgresql://${google_sql_user.user.name}:${var.db_password}@${google_sql_database_instance.postgres.private_ip_address}:5432/${google_sql_database.database.name}"
              REDIS_URL    = "redis://${google_redis_instance.redis.host}:${google_redis_instance.redis.port}"
              # Signal that this service is running in Google Cloud Run
              GCP_CLOUD_RUN  = "true"
              GCP_PROJECT_ID = var.project_id
              GOOGLE_CLOUD_PROJECT = var.project_id
              GCLOUD_PROJECT       = var.project_id
              GCP_REGION     = var.region
              # Datadog configuration (sidecar agent)
              DD_ENV                = "prod"
              DD_LOGS_INJECTION     = "true"
              DD_GIT_REPOSITORY_URL = "github.com/fishgills/mud"
              DD_SERVICE            = "mud-${each.value.name}"
              DD_SITE               = var.datadog_site
              # Send traces to local Datadog Agent sidecar
              DD_TRACE_AGENT_URL = "http://localhost:8126"
              # Attach version for better APM grouping (prefer git SHA, fallback to image tag)
              DD_VERSION = var.git_commit_sha == null ? var.image_version : var.git_commit_sha
              # Runtime metrics require DogStatsD/UDP; keep disabled on Cloud Run
              DD_RUNTIME_METRICS_ENABLED = "false"
              # Enable if desired once validated with sidecar
              DD_PROFILING_ENABLED = "true"
              # Ensure tracing is enabled
              DD_TRACE_ENABLED = "true"
            }
            # Optionally include the current git commit SHA when provided by CI
            , var.git_commit_sha == null ? {} : { DD_GIT_COMMIT_SHA = var.git_commit_sha }
          ) : k => v if k != "OPENAI_API_KEY"
        }
        content {
          name  = env.key
          value = env.value
        }
      }

      # Note: Application container no longer needs Datadog API keys in sidecar mode

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

      # Pass-through any explicitly provided Slack Bot endpoint env vars
      dynamic "env" {
        for_each = contains(["slack-bot"], each.key) ? {
          for k, v in each.value.env_vars : k => v if contains(["DM_SERVICE_URL", "WORLD_SERVICE_URL", "WORLD_RENDER_BASE_URL"], k)
        } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      # Default Slack Bot endpoint env vars derived from the Cloud Run internal hostname
      dynamic "env" {
        for_each = contains(["slack-bot"], each.key) && !contains(keys(try(each.value.env_vars, {})), "DM_SERVICE_URL") && contains(keys(local.service_runapp_alias), "dm") ? { DM_SERVICE_URL = local.service_runapp_alias["dm"] } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = contains(["slack-bot"], each.key) && !contains(keys(try(each.value.env_vars, {})), "WORLD_SERVICE_URL") && contains(keys(local.service_runapp_alias), "world") ? { WORLD_SERVICE_URL = "${local.service_runapp_alias["world"]}/world" } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      # (Slack Bot specific defaults below; World service settings follow)

      dynamic "env" {
        for_each = contains(["slack-bot"], each.key) && !contains(keys(try(each.value.env_vars, {})), "WORLD_RENDER_BASE_URL") && contains(keys(local.service_runapp_alias), "world") ? { WORLD_RENDER_BASE_URL = "${local.service_runapp_alias["world"]}/world" } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      # Auto-inject WORLD_SERVICE_URL for DM if not provided, pointing to the World service base URL
      dynamic "env" {
        for_each = contains(["dm"], each.key) && !contains(keys(try(each.value.env_vars, {})), "WORLD_SERVICE_URL") && contains(keys(local.service_preferred_url), "world") ? { WORLD_SERVICE_URL = local.service_preferred_url["world"] } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      # Auto-inject DM_SERVICE_URL for tick service (defaults to DM service base URL)
      dynamic "env" {
        for_each = contains(["tick"], each.key) && !contains(keys(try(each.value.env_vars, {})), "DM_SERVICE_URL") && contains(keys(local.service_preferred_url), "dm") ? { DM_SERVICE_URL = local.service_preferred_url["dm"] } : {}
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

    # Datadog sidecar for APM/tracing (serverless-init)
    containers {
      name  = "datadog-agent"
      image = "gcr.io/datadoghq/serverless-init:latest"

      # Allocate modest resources to the agent sidecar
      resources {
        cpu_idle = true
        limits = {
          cpu    = "200m"
          memory = "256Mi"
        }
      }

      env {
        name  = "DD_SITE"
        value = var.datadog_site
      }
      env {
        name  = "DD_ENV"
        value = "prod"
      }
      # Explicitly disable logs collection from the sidecar
      env {
        name  = "DD_LOGS_ENABLED"
        value = "false"
      }

      # Datadog API key from Secret Manager for the sidecar
      env {
        name = "DD_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.datadog_api_key.name
            version = "latest"
          }
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
