locals {
  github_actions_enabled = var.github_repository != null
  github_actions_roles = var.github_repository == null ? [] : [
    "roles/container.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/compute.networkAdmin",
    "roles/dns.admin",
    "roles/artifactregistry.admin",
    "roles/cloudsql.admin",
    "roles/redis.admin",
    "roles/secretmanager.admin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/servicenetworking.networksAdmin"
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
  display_name              = "GitHub Actions Pool"
  description               = "OIDC pool for GitHub Actions deploying MUD"
}

resource "google_iam_workload_identity_pool_provider" "github_actions" {
  count = local.github_actions_enabled ? 1 : 0

  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions[0].workload_identity_pool_id
  workload_identity_pool_provider_id = var.workload_identity_provider_id

  display_name = "GitHub Actions Pool Provider"
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

resource "google_service_account" "runtime" {
  for_each = local.service_account_ids

  account_id   = each.value
  display_name = "GKE ${each.key} (${var.environment})"
  description  = "Runtime identity for the ${each.key} service running on GKE"
}

resource "google_project_iam_member" "runtime_artifact_registry_reader" {
  for_each = google_service_account.runtime

  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${each.value.email}"
}

locals {
  services_using_database = {
    for key, sa in google_service_account.runtime :
    key => sa
    if key != "tick"
  }
}

resource "google_project_iam_member" "runtime_cloudsql" {
  for_each = local.services_using_database

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${each.value.email}"
}

resource "google_project_iam_member" "runtime_secret_accessor" {
  for_each = {
    for key, sa in google_service_account.runtime :
    key => sa if key != "tick"
  }

  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${each.value.email}"
}

resource "google_project_iam_member" "runtime_vertex_ai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.runtime["dm"].email}"
}

resource "google_service_account_iam_binding" "runtime_workload_identity" {
  for_each = google_service_account.runtime

  service_account_id = each.value.name
  role               = "roles/iam.workloadIdentityUser"
  members = [
    "serviceAccount:${var.project_id}.svc.id.goog/${local.kubernetes_namespace}/${each.key}"
  ]
}
