# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "dns.googleapis.com",
    "oslogin.googleapis.com",
    "aiplatform.googleapis.com"
  ])

  service            = each.key
  disable_on_destroy = false
}
