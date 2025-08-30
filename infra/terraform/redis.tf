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
