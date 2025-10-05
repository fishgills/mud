# Output values for reference
output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "load_balancer_ip" {
  value = var.enable_load_balancer ? google_compute_global_address.default[0].address : null
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

output "github_actions_service_account_email" {
  description = "Service account email used by GitHub Actions when Workload Identity Federation is enabled."
  value       = try(google_service_account.github_actions[0].email, null)
}

output "github_actions_workload_identity_provider" {
  description = "Full resource name of the Workload Identity Provider for GitHub Actions."
  value       = try(google_iam_workload_identity_pool_provider.github_actions[0].name, null)
}

output "datadog_integration_service_account_email" {
  description = "Service account email to add in Datadog GCP integration (project-level). Create a JSON key for this SA and upload to Datadog."
  value       = google_service_account.datadog_gcp_service_account.email
}
