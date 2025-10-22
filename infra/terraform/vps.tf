locals {
  hostnames = concat([
    var.domain
  ], var.additional_hostnames)
}

resource "google_compute_address" "vps_ip" {
  name         = "mud-vps-ip"
  region       = var.region
  address_type = "EXTERNAL"
}

resource "google_compute_instance" "vps" {
  name         = "mud-vps"
  machine_type = var.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = var.boot_disk_image
      size  = var.boot_disk_size_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    network    = google_compute_network.vpc.id
    subnetwork = google_compute_subnetwork.subnet.id

    access_config {
      nat_ip = google_compute_address.vps_ip.address
    }
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  service_account {
    email = google_service_account.vps_sa.email
    scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]
  }

  tags = ["mud-vps"]
  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  # Allow terraform to stop the instance when necessary for updates that
  # require the instance to be stopped (changing machine_type, service_account, etc.)
  allow_stopping_for_update = true

  depends_on = [google_project_service.apis]
}

resource "google_service_account" "vps_sa" {
  account_id   = "mud-vps-sa"
  display_name = "Service account for mud VPS"
}

# Grant the service account permission to read from Artifact Registry so the
# VM's default token can be used to pull images or read artifacts.
resource "google_project_iam_member" "vps_sa_artifact_reader" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.vps_sa.email}"
}

resource "google_dns_record_set" "apex" {
  for_each = toset(local.hostnames)

  managed_zone = data.google_dns_managed_zone.zone.name
  name         = "${each.value}."
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.lb_ip.address]
}
