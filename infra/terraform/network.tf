# Dedicated VPC for the VPS host
resource "google_compute_network" "vpc" {
  name                    = "mud-vpc"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}

resource "google_compute_subnetwork" "subnet" {
  name          = "mud-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true
}

# Allow SSH from anywhere (lock down further in production)
resource "google_compute_firewall" "allow_ssh" {
  name    = "mud-allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  direction = "INGRESS"
  priority  = 1000
  source_ranges = [
    "0.0.0.0/0"
  ]
}

# Allow HTTP/HTTPS traffic to the VPS
resource "google_compute_firewall" "allow_http" {
  name    = "mud-allow-http"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  direction = "INGRESS"
  priority  = 1000
  source_ranges = [
    "0.0.0.0/0"
  ]
}
