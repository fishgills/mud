# Shared VPC used by serverless services (Cloud Run, Memorystore, Cloud SQL private IP)
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

resource "google_compute_subnetwork" "serverless_connector" {
  name          = "mud-serverless-${var.environment}"
  ip_cidr_range = "10.16.16.0/28"
  region        = var.region
  network       = google_compute_network.shared.id
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

# Serverless VPC Access connector so Cloud Run services can reach Redis/Cloud SQL private IPs
resource "google_vpc_access_connector" "serverless" {
  # Use a distinct name so Terraform can replace the connector without colliding
  name   = "mud-${var.environment}-connector"
  region = var.region

  subnet {
    name = google_compute_subnetwork.serverless_connector.name
  }

  min_throughput = 200
  max_throughput = 300

  depends_on = [
    google_compute_subnetwork.serverless_connector,
    google_project_service.apis
  ]
}
