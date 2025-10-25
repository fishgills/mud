# Shared VPC used by GKE, Memorystore, and Cloud SQL private IPs
resource "google_compute_network" "shared" {
  name                    = "mud-shared-${var.environment}"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "shared" {
  name          = "mud-shared-${var.environment}"
  ip_cidr_range = "10.16.0.0/20"
  region        = var.region
  network       = google_compute_network.shared.id

  private_ip_google_access = true
}

resource "google_compute_subnetwork" "gke" {
  name    = "mud-gke-${var.environment}"
  region  = var.region
  network = google_compute_network.shared.id

  ip_cidr_range = "10.20.0.0/20"

  secondary_ip_range {
    range_name    = "mud-gke-pods-${var.environment}"
    ip_cidr_range = "10.32.0.0/19"
  }

  secondary_ip_range {
    range_name    = "mud-gke-services-${var.environment}"
    ip_cidr_range = "10.33.0.0/23"
  }

  private_ip_google_access = true
}

# Reserve an internal range for private service access (Cloud SQL)
resource "google_compute_global_address" "private_service_range" {
  name          = "mud-sql-range-${var.environment}"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.shared.self_link
  depends_on    = [google_project_service.apis]
}

resource "google_service_networking_connection" "private_service_connection" {
  network                 = google_compute_network.shared.self_link
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_service_range.name]
  depends_on              = [google_project_service.apis]
}

