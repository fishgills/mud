# Output values for reference
output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "vps_instance_name" {
  description = "Name of the Compute Engine instance running the stack"
  value       = google_compute_instance.vps.name
}

output "vps_ip_address" {
  description = "Static external IP assigned to the VPS"
  value       = google_compute_address.vps_ip.address
}

output "managed_hostnames" {
  description = "DNS hostnames that resolve to the VPS"
  value       = local.hostnames
}

output "github_actions_service_account_email" {
  description = "Service account email used by GitHub Actions when Workload Identity Federation is enabled."
  value       = try(google_service_account.github_actions[0].email, null)
}

output "github_actions_workload_identity_provider" {
  description = "Full resource name of the Workload Identity Provider for GitHub Actions."
  value       = try(google_iam_workload_identity_pool_provider.github_actions[0].name, null)
}
