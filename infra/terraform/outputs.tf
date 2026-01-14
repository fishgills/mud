# Output values for reference
output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "cloud_sql_instance_connection_name" {
  description = "Connection name for the Cloud SQL instance."
  value       = google_sql_database_instance.postgres.connection_name
}

output "redis_host" {
  description = "Private IP address of the Memorystore Redis instance."
  value       = google_redis_instance.cache.host
}

output "gke_cluster_name" {
  description = "Name of the primary GKE cluster."
  value       = google_container_cluster.primary.name
}

output "gke_cluster_location" {
  description = "Zone where the primary GKE cluster is provisioned."
  value       = local.gke_location
}

output "public_ingress_ip" {
  description = "External IP address for the public HTTP(S) ingress."
  value       = google_compute_global_address.gke_ingress.address
}

output "public_service_domains" {
  description = "Domains routed through the shared GKE ingress."
  value = {
    slack = local.domain_mappings.slack
    web   = local.domain_mappings.web
    www   = local.domain_mappings.www
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
