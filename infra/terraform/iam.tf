# GitHub Actions Workload Identity Federation configuration
locals {
  github_actions_repository_full_name = var.enable_github_actions_workload_identity ? "${var.github_actions_owner}/${var.github_actions_repository}" : null
  github_actions_attribute_condition = var.enable_github_actions_workload_identity ? (
    var.github_actions_attribute_condition != null
    ? var.github_actions_attribute_condition
    : format(
        "assertion.repository == \"%s\" && assertion.ref == \"%s\"",
        local.github_actions_repository_full_name,
        var.github_actions_ref,
      )
  ) : null
}

resource "google_service_account" "github_actions" {
  count        = var.enable_github_actions_workload_identity ? 1 : 0
  account_id   = var.github_actions_service_account_id
  display_name = "GitHub Actions deployer"
}

resource "google_project_iam_member" "github_actions_roles" {
  for_each = var.enable_github_actions_workload_identity ? toset(var.github_actions_service_account_roles) : []

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.github_actions[0].email}"
}

resource "google_iam_workload_identity_pool" "github_actions" {
  count                       = var.enable_github_actions_workload_identity ? 1 : 0
  workload_identity_pool_id   = var.github_actions_workload_identity_pool_id
  display_name                = "GitHub Actions"
  description                 = "OIDC pool for GitHub Actions deployments"
  disabled                    = false
  depends_on                  = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github_actions" {
  count = var.enable_github_actions_workload_identity ? 1 : 0

  provider_id               = var.github_actions_workload_identity_provider_id
  workload_identity_pool_id = google_iam_workload_identity_pool.github_actions[0].workload_identity_pool_id
  display_name              = "GitHub Actions"
  description               = "OIDC provider for GitHub Actions"

  attribute_mapping = {
    "google.subject"        = "assertion.sub"
    "attribute.actor"       = "assertion.actor"
    "attribute.repository"  = "assertion.repository"
    "attribute.ref"         = "assertion.ref"
    "attribute.environment" = "assertion.environment"
  }

  attribute_condition = local.github_actions_attribute_condition

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_actions_wi_user" {
  count = var.enable_github_actions_workload_identity ? 1 : 0

  service_account_id = google_service_account.github_actions[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github_actions[0].name}/attribute.repository/${local.github_actions_repository_full_name}"
}
