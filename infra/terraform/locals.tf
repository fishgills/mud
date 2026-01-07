locals {
  project_id           = var.project_id
  region               = var.region
  environment          = var.environment
  gke_location         = coalesce(var.gke_zone, "${var.region}-a")
  kubernetes_namespace = "mud"

  service_names = {
    dm    = "dm-${var.environment}"
    world = "world-${var.environment}"
    slack = "slack-${var.environment}"
    tick  = "tick-${var.environment}"
    web   = "web-${var.environment}"
  }

  service_account_ids = {
    dm    = "dm-run-${var.environment}"
    world = "world-run-${var.environment}"
    slack = "slack-run-${var.environment}"
    tick  = "tick-run-${var.environment}"
    web   = "web-run-${var.environment}"
  }

  domain_mappings = {
    slack = "slack.${var.domain}"
    world = "world.${var.domain}"
    web   = var.domain
    www   = "www.${var.domain}"
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
}
