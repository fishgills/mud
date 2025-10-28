locals {
  project_id           = var.project_id
  region               = var.region
  environment          = var.environment
  gke_location         = coalesce(var.gke_zone, "${var.region}-a")
  kubernetes_namespace = "mud"

  service_names = {
    dm    = "dm"
    world = "world"
    slack = "slack"
    tick  = "tick"
  }

  service_account_ids = {
    dm    = "dm-run-${var.environment}"
    world = "world-run-${var.environment}"
    slack = "slack-run-${var.environment}"
    tick  = "tick-run-${var.environment}"
  }

  runtime_service_account_emails = {
    for key, id in local.service_account_ids :
    key => "${id}@${var.project_id}.iam.gserviceaccount.com"
  }

  github_actions_enabled            = var.github_repository != null
  github_actions_service_account_id = "github-actions"
  github_actions_kubernetes_user    = local.github_actions_enabled ? "system:serviceaccount:${var.project_id}.svc.id.goog[${local.github_actions_service_account_id}]" : null

  domain_mappings = {
    slack = "slack.${var.domain}"
    world = "world.${var.domain}"
  }

  images = {
    dm = coalesce(
      var.dm_image,
      "${var.artifact_repo_location}-docker.pkg.dev/${var.project_id}/${var.artifact_repo_id}/dm:latest"
    )
    world = coalesce(
      var.world_image,
      "${var.artifact_repo_location}-docker.pkg.dev/${var.project_id}/${var.artifact_repo_id}/world:latest"
    )
    slack = coalesce(
      var.slack_bot_image,
      "${var.artifact_repo_location}-docker.pkg.dev/${var.project_id}/${var.artifact_repo_id}/slack:latest"
    )
    tick = coalesce(
      var.tick_image,
      "${var.artifact_repo_location}-docker.pkg.dev/${var.project_id}/${var.artifact_repo_id}/tick:latest"
    )
  }

  provided_secret_ids = {
    openai               = "openai-api-key"
    slack_token          = "slack-token"
    slack_signing_secret = "slack-signing-secret"
    slack_app_token      = "slack-app-token"
    slack_client_id      = "slack-client-id"
    slack_client_secret  = "slack-client-secret"
    slack_state_secret   = "slack-state-secret"
  }

  provided_secret_values = {
    openai               = var.openai_api_key
    slack_token          = var.slack_bot_token
    slack_signing_secret = var.slack_signing_secret
    slack_app_token      = var.slack_app_token
    slack_client_id      = var.slack_client_id
    slack_client_secret  = var.slack_client_secret
    slack_state_secret   = var.slack_state_secret
  }

  provided_secrets_with_values = nonsensitive({
    for key, secret_id in local.provided_secret_ids :
    key => {
      name  = secret_id
      value = local.provided_secret_values[key]
    }
    if local.provided_secret_values[key] != null
  })

  database_secret_id = "database-url"
  database_secret_payload = {
    latest = data.google_secret_manager_secret_version.database_url.secret_data
  }

  provided_secret_payloads = {
    for key, config in local.provided_secrets_with_values :
    key => {
      name = config.name
      data = {
        latest = base64encode(config.value)
      }
    }
  }
}

data "google_client_config" "default" {}

data "google_container_cluster" "primary" {
  name     = "mud-${var.environment}"
  location = local.gke_location
}

data "google_secret_manager_secret_version" "database_url" {
  project = var.project_id
  secret  = local.database_secret_id
  version = "latest"
}

data "google_redis_instance" "cache" {
  project = var.project_id
  name    = var.redis_instance_name
  region  = var.region
}

data "google_compute_global_address" "gke_ingress" {
  project = var.project_id
  name    = "mud-gke-ingress-${var.environment}"
}

provider "kubernetes" {
  host                   = "https://${data.google_container_cluster.primary.endpoint}"
  cluster_ca_certificate = base64decode(data.google_container_cluster.primary.master_auth[0].cluster_ca_certificate)
  token                  = data.google_client_config.default.access_token
}

resource "kubernetes_cluster_role_binding" "github_actions_admin" {
  count = local.github_actions_enabled ? 1 : 0

  metadata {
    name = "github-actions-cluster-admin"
    labels = {
      app         = "github-actions"
      environment = var.environment
    }
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin"
  }

  subject {
    kind      = "User"
    name      = local.github_actions_kubernetes_user
    api_group = "rbac.authorization.k8s.io"
  }
}

resource "kubernetes_namespace" "mud" {
  metadata {
    name = local.kubernetes_namespace
    labels = {
      environment = var.environment
    }
  }
}

resource "kubernetes_service_account" "runtime" {
  for_each = local.service_names

  metadata {
    name      = each.value
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = each.value
      environment = var.environment
    }
    annotations = {
      "iam.gke.io/gcp-service-account" = local.runtime_service_account_emails[each.key]
    }
  }
}

resource "kubernetes_secret" "database_url" {
  metadata {
    name      = local.database_secret_id
    namespace = kubernetes_namespace.mud.metadata[0].name
  }

  data = local.database_secret_payload

  type = "Opaque"
}

resource "kubernetes_secret" "provided" {
  for_each = local.provided_secret_payloads

  metadata {
    name      = each.value.name
    namespace = kubernetes_namespace.mud.metadata[0].name
  }

  data = each.value.data

  type = "Opaque"
}

resource "kubernetes_deployment" "world" {
  metadata {
    name      = local.service_names.world
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = local.service_names.world
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = local.service_names.world
      }
    }

    template {
      metadata {
        labels = {
          app         = local.service_names.world
          environment = var.environment
        }
      }

      spec {
        service_account_name = kubernetes_service_account.runtime["world"].metadata[0].name

        container {
          name  = local.service_names.world
          image = local.images.world

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
            requests = {
              cpu    = "500m"
              memory = "256Mi"
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
            name  = "REDIS_URL"
            value = "redis://${data.google_redis_instance.cache.host}:6379"
          }

          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.database_url.metadata[0].name
                key  = "latest"
              }
            }
          }

          liveness_probe {
            http_get {
              path = "/world/health-check"
              port = 8080
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/world/health-check"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment" "dm" {
  metadata {
    name      = local.service_names.dm
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = local.service_names.dm
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = local.service_names.dm
      }
    }

    template {
      metadata {
        labels = {
          app         = local.service_names.dm
          environment = var.environment
        }
      }

      spec {
        service_account_name = kubernetes_service_account.runtime["dm"].metadata[0].name

        container {
          name  = local.service_names.dm
          image = local.images.dm

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
            requests = {
              cpu    = "100m"
              memory = "256Mi"
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
            name  = "DM_USE_VERTEX_AI"
            value = "true"
          }

          env {
            name = "OPENAI_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.provided["openai"].metadata[0].name
                key  = "latest"
              }
            }
          }

          env {
            name  = "REDIS_URL"
            value = "redis://${data.google_redis_instance.cache.host}:6379"
          }

          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.database_url.metadata[0].name
                key  = "latest"
              }
            }
          }

          env {
            name  = "WORLD_SERVICE_URL"
            value = "http://${local.service_names.world}.${local.kubernetes_namespace}.svc.cluster.local/world"
          }

          liveness_probe {
            http_get {
              path = "/health-check"
              port = 8080
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health-check"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment" "slack" {
  metadata {
    name      = local.service_names.slack
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = local.service_names.slack
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = local.service_names.slack
      }
    }

    template {
      metadata {
        labels = {
          app         = local.service_names.slack
          environment = var.environment
        }
      }

      spec {
        service_account_name = kubernetes_service_account.runtime["slack"].metadata[0].name

        container {
          name  = local.service_names.slack
          image = local.images.slack

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
            requests = {
              cpu    = "100m"
              memory = "256Mi"
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
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.database_url.metadata[0].name
                key  = "latest"
              }
            }
          }

          env {
            name  = "REDIS_URL"
            value = "redis://${data.google_redis_instance.cache.host}:6379"
          }

          env {
            name  = "DM_API_BASE_URL"
            value = "http://${local.service_names.dm}.${local.kubernetes_namespace}.svc.cluster.local"
          }

          env {
            name  = "WORLD_API_BASE_URL"
            value = "http://${local.service_names.world}.${local.kubernetes_namespace}.svc.cluster.local/world"
          }

          env {
            name = "SLACK_BOT_TOKEN"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.provided["slack_token"].metadata[0].name
                key  = "latest"
              }
            }
          }

          env {
            name = "SLACK_SIGNING_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.provided["slack_signing_secret"].metadata[0].name
                key  = "latest"
              }
            }
          }

          env {
            name = "SLACK_APP_TOKEN"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.provided["slack_app_token"].metadata[0].name
                key  = "latest"
              }
            }
          }

          env {
            name = "SLACK_CLIENT_ID"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.provided["slack_client_id"].metadata[0].name
                key  = "latest"
              }
            }
          }

          env {
            name = "SLACK_CLIENT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.provided["slack_client_secret"].metadata[0].name
                key  = "latest"
              }
            }
          }

          env {
            name = "SLACK_STATE_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.provided["slack_state_secret"].metadata[0].name
                key  = "latest"
              }
            }
          }

          liveness_probe {
            http_get {
              path = "/health-check"
              port = 8080
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health-check"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment" "tick" {
  metadata {
    name      = local.service_names.tick
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = local.service_names.tick
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = local.service_names.tick
      }
    }

    template {
      metadata {
        labels = {
          app         = local.service_names.tick
          environment = var.environment
        }
      }

      spec {
        service_account_name = kubernetes_service_account.runtime["tick"].metadata[0].name

        container {
          name  = local.service_names.tick
          image = local.images.tick

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "1"
              memory = "1Gi"
            }
            requests = {
              cpu    = "100m"
              memory = "256Mi"
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
            name  = "TICK_INTERVAL_MS"
            value = "600000"
          }

          env {
            name  = "DM_API_BASE_URL"
            value = "http://${local.service_names.dm}.${local.kubernetes_namespace}.svc.cluster.local"
          }

          liveness_probe {
            http_get {
              path = "/health-check"
              port = 8080
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/health-check"
              port = 8080
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "world" {
  metadata {
    name      = local.service_names.world
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app = local.service_names.world
    }
    annotations = {
      "cloud.google.com/backend-config" = "{\"default\":\"world-backend-config\"}"
    }
  }

  spec {
    type = "NodePort"

    selector = {
      app = local.service_names.world
    }

    port {
      name        = "http"
      port        = 80
      target_port = 8080
      node_port   = 30080
    }
  }
}

resource "kubernetes_service" "dm" {
  metadata {
    name      = local.service_names.dm
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app = local.service_names.dm
    }
  }

  spec {
    selector = {
      app = local.service_names.dm
    }

    port {
      name        = "http"
      port        = 80
      target_port = 8080
    }
  }
}

resource "kubernetes_service" "slack" {
  metadata {
    name      = local.service_names.slack
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app = local.service_names.slack
    }
    annotations = {
      "cloud.google.com/backend-config" = "{\"default\":\"slack-backend-config\"}"
    }
  }

  spec {
    type = "NodePort"

    selector = {
      app = local.service_names.slack
    }

    port {
      name        = "http"
      port        = 80
      target_port = 8080
      node_port   = 30081
    }
  }
}

resource "kubernetes_service" "tick" {
  metadata {
    name      = local.service_names.tick
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app = local.service_names.tick
    }
  }

  spec {
    selector = {
      app = local.service_names.tick
    }

    port {
      name        = "http"
      port        = 80
      target_port = 8080
    }
  }
}

resource "kubernetes_manifest" "managed_certificate" {
  manifest = {
    apiVersion = "networking.gke.io/v1"
    kind       = "ManagedCertificate"
    metadata = {
      name      = "mud-public-cert"
      namespace = kubernetes_namespace.mud.metadata[0].name
    }
    spec = {
      domains = [
        local.domain_mappings.world,
        local.domain_mappings.slack,
      ]
    }
  }
}

resource "kubernetes_ingress_v1" "public" {
  metadata {
    name      = "mud-public"
    namespace = kubernetes_namespace.mud.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"                 = "gce"
      "kubernetes.io/ingress.global-static-ip-name" = data.google_compute_global_address.gke_ingress.name
      "networking.gke.io/managed-certificates"      = kubernetes_manifest.managed_certificate.manifest["metadata"]["name"]
    }
  }

  spec {
    default_backend {
      service {
        name = kubernetes_service.world.metadata[0].name
        port {
          number = 80
        }
      }
    }

    rule {
      host = local.domain_mappings.world
      http {
        path {
          path = "/*"
          backend {
            service {
              name = kubernetes_service.world.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }

    rule {
      host = local.domain_mappings.slack
      http {
        path {
          path = "/*"
          backend {
            service {
              name = kubernetes_service.slack.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_manifest" "backend_config_world" {
  manifest = {
    apiVersion = "cloud.google.com/v1"
    kind       = "BackendConfig"
    metadata = {
      name      = "world-backend-config"
      namespace = kubernetes_namespace.mud.metadata[0].name
    }
    spec = {
      healthCheck = {
        checkIntervalSec   = 10
        timeoutSec         = 5
        healthyThreshold   = 2
        unhealthyThreshold = 3
        requestPath        = "/world/health-check"
        # Health checks must hit the NodePort on the node. Service `world` uses NodePort 30080.
        port = 30080
        type = "HTTP"
      }
    }
  }
}

resource "kubernetes_manifest" "backend_config_slack" {
  manifest = {
    apiVersion = "cloud.google.com/v1"
    kind       = "BackendConfig"
    metadata = {
      name      = "slack-backend-config"
      namespace = kubernetes_namespace.mud.metadata[0].name
    }
    spec = {
      healthCheck = {
        checkIntervalSec   = 10
        timeoutSec         = 5
        healthyThreshold   = 2
        unhealthyThreshold = 3
        requestPath        = "/health-check"
        # Health checks must hit the NodePort on the node. Service `slack` uses NodePort 30081.
        port = 30081
        type = "HTTP"
      }
    }
  }
}
