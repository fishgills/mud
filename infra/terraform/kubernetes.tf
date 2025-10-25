locals {
  dm_service_name        = "dm"
  world_service_name     = "world"
  slack_bot_service_name = "slack-bot"
  tick_service_name      = "tick"
}

resource "kubernetes_namespace" "mud" {
  metadata {
    name = local.kubernetes_namespace
    labels = {
      environment = var.environment
    }
  }
}

resource "kubernetes_cluster_role_binding" "github_actions_cluster_admin" {
  count = local.github_actions_enabled ? 1 : 0

  metadata {
    name = "github-actions-cluster-admin"
    labels = {
      environment = var.environment
    }
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = "cluster-admin"
  }

  subject {
    kind = "User"
    name = "system:serviceaccount:${var.project_id}.svc.id.goog"
  }

  depends_on = [google_container_node_pool.primary]
}

resource "kubernetes_service_account" "runtime" {
  for_each = google_service_account.runtime

  metadata {
    name      = each.key
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = each.key
      environment = var.environment
    }
    annotations = {
      "iam.gke.io/gcp-service-account" = each.value.email
    }
  }
}

resource "kubernetes_secret" "database_url" {
  metadata {
    name      = google_secret_manager_secret.database_url.secret_id
    namespace = kubernetes_namespace.mud.metadata[0].name
  }

  string_data = {
    latest = local.database_url
  }
}

resource "kubernetes_secret" "provided" {
  for_each = local.provided_secrets_with_values

  metadata {
    name      = each.value
    namespace = kubernetes_namespace.mud.metadata[0].name
  }

  string_data = {
    latest = local.provided_secret_values[each.key]
  }
}

resource "kubernetes_deployment" "world" {
  metadata {
    name      = local.world_service_name
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = local.world_service_name
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = local.world_service_name
      }
    }

    template {
      metadata {
        labels = {
          app         = local.world_service_name
          environment = var.environment
        }
      }

      spec {
        service_account_name = kubernetes_service_account.runtime[local.world_service_name].metadata[0].name

        container {
          name  = local.world_service_name
          image = local.images.world

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "1000m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "500m"
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
            name  = "REDIS_URL"
            value = "redis://${google_redis_instance.cache.host}:6379"
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
        }
      }
    }
  }
}

resource "kubernetes_deployment" "dm" {
  metadata {
    name      = local.dm_service_name
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = local.dm_service_name
      environment = var.environment
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = local.dm_service_name
      }
    }

    template {
      metadata {
        labels = {
          app         = local.dm_service_name
          environment = var.environment
        }
      }

      spec {
        service_account_name = kubernetes_service_account.runtime[local.dm_service_name].metadata[0].name

        container {
          name  = local.dm_service_name
          image = local.images.dm

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "1000m"
              memory = "1Gi"
            }
            requests = {
              cpu    = "500m"
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
            value = "redis://${google_redis_instance.cache.host}:6379"
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
            value = "http://${local.world_service_name}.${local.kubernetes_namespace}.svc.cluster.local/world"
          }
        }
      }
    }
  }
}

resource "kubernetes_deployment" "slack_bot" {
  metadata {
    name      = local.slack_bot_service_name
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = local.slack_bot_service_name
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = local.slack_bot_service_name
      }
    }

    template {
      metadata {
        labels = {
          app         = local.slack_bot_service_name
          environment = var.environment
        }
      }

      spec {
        service_account_name = kubernetes_service_account.runtime[local.slack_bot_service_name].metadata[0].name

        container {
          name  = local.slack_bot_service_name
          image = local.images.slack_bot

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "1000m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "250m"
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
            name  = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.database_url.metadata[0].name
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
            value = "http://${local.dm_service_name}.${local.kubernetes_namespace}.svc.cluster.local"
          }

          env {
            name  = "WORLD_API_BASE_URL"
            value = "http://${local.world_service_name}.${local.kubernetes_namespace}.svc.cluster.local/world"
          }

          env {
            name = "SLACK_BOT_TOKEN"
            value_from {
              secret_key_ref {
            name = kubernetes_secret.provided["slack_bot_token"].metadata[0].name
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
        }
      }
    }
  }
}

resource "kubernetes_deployment" "tick" {
  metadata {
    name      = local.tick_service_name
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app         = local.tick_service_name
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = local.tick_service_name
      }
    }

    template {
      metadata {
        labels = {
          app         = local.tick_service_name
          environment = var.environment
        }
      }

      spec {
        service_account_name = kubernetes_service_account.runtime[local.tick_service_name].metadata[0].name

        container {
          name  = local.tick_service_name
          image = local.images.tick

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "1000m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "250m"
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
            value = "http://${local.dm_service_name}.${local.kubernetes_namespace}.svc.cluster.local"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "world" {
  metadata {
    name      = local.world_service_name
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app = local.world_service_name
    }
  }

  spec {
    type = "NodePort"

    selector = {
      app = local.world_service_name
    }

    port {
      name       = "http"
      port       = 80
      target_port = 8080
    }
  }
}

resource "kubernetes_service" "dm" {
  metadata {
    name      = local.dm_service_name
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app = local.dm_service_name
    }
  }

  spec {
    selector = {
      app = local.dm_service_name
    }

    port {
      name        = "http"
      port        = 80
      target_port = 8080
    }
  }
}

resource "kubernetes_service" "slack_bot" {
  metadata {
    name      = local.slack_bot_service_name
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app = local.slack_bot_service_name
    }
  }

  spec {
    type = "NodePort"

    selector = {
      app = local.slack_bot_service_name
    }

    port {
      name       = "http"
      port       = 80
      target_port = 8080
    }
  }
}

resource "kubernetes_service" "tick" {
  metadata {
    name      = local.tick_service_name
    namespace = kubernetes_namespace.mud.metadata[0].name
    labels = {
      app = local.tick_service_name
    }
  }

  spec {
    selector = {
      app = local.tick_service_name
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
        local.domain_mappings.slack_bot,
      ]
    }
  }
}

resource "kubernetes_ingress_v1" "public" {
  metadata {
    name      = "mud-public"
    namespace = kubernetes_namespace.mud.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class"             = "gce"
      "kubernetes.io/ingress.global-static-ip-name" = google_compute_global_address.gke_ingress.name
      "networking.gke.io/managed-certificates"  = kubernetes_manifest.managed_certificate.manifest["metadata"]["name"]
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
          path      = "/"
          path_type = "Prefix"

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
      host = local.domain_mappings.slack_bot

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.slack_bot.metadata[0].name
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
