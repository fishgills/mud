# Output values for reference
output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "load_balancer_ip" {
  value = google_compute_global_address.default.address
}

output "database_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}

output "database_private_ip" {
  value = google_sql_database_instance.postgres.private_ip_address
}

output "redis_host" {
  value = google_redis_instance.redis.host
}

output "redis_port" {
  value = google_redis_instance.redis.port
}

output "artifact_registry_repository" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${data.google_artifact_registry_repository.repo.repository_id}"
}

output "service_urls" {
  value = {
    for service_key, service in var.services : service.name => "https://${service.name}.${var.domain}"
  }
}

output "cloud_run_services" {
  value = {
    for service_key, service in var.services : service.name => {
      name = google_cloud_run_v2_service.services[service_key].name
      url  = google_cloud_run_v2_service.services[service_key].uri
    }
  }
}