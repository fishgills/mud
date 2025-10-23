resource "google_artifact_registry_repository" "services" {
  location      = var.artifact_repo_location
  repository_id = var.artifact_repo_id
  description   = "Container images for MUD services"
  format        = "DOCKER"
  project       = var.project_id

  docker_config {
    immutable_tags = false
  }
}
