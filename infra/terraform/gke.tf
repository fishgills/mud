resource "google_container_cluster" "primary" {
  name     = "mud-${var.environment}"
  location = local.gke_location
  network  = google_compute_network.shared.self_link
  subnetwork = google_compute_subnetwork.gke.name

  remove_default_node_pool = true
  initial_node_count       = 1

  release_channel {
    channel = "REGULAR"
  }

  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  ip_allocation_policy {
    cluster_secondary_range_name  = "mud-gke-pods-${var.environment}"
    services_secondary_range_name = "mud-gke-services-${var.environment}"
  }

  logging_service    = "logging.googleapis.com/kubernetes"
  monitoring_service = "monitoring.googleapis.com/kubernetes"

  addons_config {
    http_load_balancing {
      disabled = false
    }

    horizontal_pod_autoscaling {
      disabled = false
    }
  }

  depends_on = [
    google_project_service.apis,
    google_compute_subnetwork.gke
  ]
}

resource "google_container_node_pool" "primary" {
  name     = "mud-primary-${var.environment}"
  location = local.gke_location
  cluster  = google_container_cluster.primary.name

  initial_node_count = var.gke_min_node_count

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  autoscaling {
    min_node_count = var.gke_min_node_count
    max_node_count = var.gke_max_node_count
  }

  node_config {
    machine_type = var.gke_machine_type
    disk_size_gb = var.gke_node_disk_size_gb
    image_type   = "COS_CONTAINERD"

    metadata = {
      disable-legacy-endpoints = "true"
    }

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
    ]

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    shielded_instance_config {
      enable_secure_boot = true
    }
  }
}

data "google_container_cluster" "primary" {
  name     = google_container_cluster.primary.name
  location = local.gke_location

  depends_on = [google_container_node_pool.primary]
}

data "google_client_config" "default" {}

resource "google_compute_global_address" "gke_ingress" {
  name = "mud-gke-ingress-${var.environment}"
}
