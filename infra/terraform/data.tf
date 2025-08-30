# Reference existing Artifact Registry repository
data "google_artifact_registry_repository" "repo" {
  repository_id = "mud-registry"
  location      = var.region
}

# Project data to obtain project number for default compute service account
data "google_project" "project" {}

# Get existing DNS zone
data "google_dns_managed_zone" "zone" {
  name = var.dns_zone_name
}
