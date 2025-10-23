# Output values for reference
output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "cloud_run_urls" {
  description = "Base URLs for deployed Cloud Run services."
  value = {
    dm        = google_cloud_run_service.dm.status[0].url
    world     = google_cloud_run_service.world.status[0].url
    slack_bot = google_cloud_run_service.slack_bot.status[0].url
    tick      = google_cloud_run_service.tick.status[0].url
  }
}

output "cloud_sql_instance_connection_name" {
  description = "Connection name used by Cloud SQL Auth proxy / Cloud Run integrations."
  value       = google_sql_database_instance.postgres.connection_name
}

output "redis_host" {
  description = "Private IP address of the Memorystore Redis instance."
  value       = google_redis_instance.cache.host
}

output "github_actions_service_account_email" {
  description = "Service account email used by GitHub Actions when Workload Identity Federation is enabled."
  value       = try(google_service_account.github_actions[0].email, null)
}

output "github_actions_workload_identity_provider" {
  description = "Full resource name of the Workload Identity Provider for GitHub Actions."
  value       = try(google_iam_workload_identity_pool_provider.github_actions[0].name, null)
}
