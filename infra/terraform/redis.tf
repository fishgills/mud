resource "google_redis_instance" "cache" {
  name               = var.redis_instance_name
  region             = var.region
  location_id        = "${var.region}-a"
  tier               = var.redis_tier
  memory_size_gb     = var.redis_memory_size_gb
  redis_version      = "REDIS_7_0"
  authorized_network = google_compute_network.shared.id
  connect_mode       = "DIRECT_PEERING"

  depends_on = [
    google_compute_subnetwork.shared,
    google_project_service.apis
  ]
}
