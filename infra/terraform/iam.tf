locals {
  github_actions_enabled = var.github_repository != null
  github_actions_roles = var.github_repository == null ? [] : [
    "roles/compute.instanceAdmin.v1",
    "roles/compute.osLogin",
    "roles/iam.serviceAccountUser",
    "roles/dns.admin",
    "roles/artifactregistry.writer",
  ]
}

resource "google_service_account" "github_actions" {
  count = local.github_actions_enabled ? 1 : 0

  account_id   = "github-actions"
  display_name = "GitHub Actions deployer"
  description  = "Deploy infrastructure and services from GitHub Actions"
}

resource "google_project_iam_member" "github_actions_roles" {
  for_each = toset(local.github_actions_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions[0].email}"
}

resource "google_iam_workload_identity_pool" "github_actions" {
  count = local.github_actions_enabled ? 1 : 0

  workload_identity_pool_id = var.workload_identity_pool_id
  display_name              = "GitHub Actions"
  description               = "OIDC pool for GitHub Actions deploying MUD"
}

resource "google_iam_workload_identity_pool_provider" "github_actions" {
  count = local.github_actions_enabled ? 1 : 0

  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions[0].workload_identity_pool_id
  workload_identity_pool_provider_id = var.workload_identity_provider_id

  display_name = "GitHub Actions"
  description  = "GitHub OIDC provider for the MUD repository"

  attribute_condition = "attribute.repository == \"${var.github_repository}\""
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_binding" "github_actions_workload_identity" {
  count = local.github_actions_enabled ? 1 : 0

  service_account_id = google_service_account.github_actions[0].name
  role               = "roles/iam.workloadIdentityUser"
  members = [
    "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_actions[0].name}/attribute.repository/${var.github_repository}"
  ]
}
