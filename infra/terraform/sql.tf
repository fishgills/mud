resource "random_password" "db_password" {
  length           = 24
  special          = true
  override_special = "_-"
}

resource "google_sql_database_instance" "postgres" {
  name             = var.database_instance_name
  region           = var.region
  database_version = var.database_version

  settings {
    tier              = var.database_tier
    disk_autoresize   = true
    disk_size         = 20
    disk_type         = "PD_SSD"
    availability_type = "ZONAL"

    backup_configuration {
      enabled = true
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.shared.self_link
      require_ssl     = false
    }
  }

  deletion_protection = true

  depends_on = [google_service_networking_connection.private_service_connection]
}

resource "google_sql_database" "app" {
  name     = var.database_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app_user" {
  instance = google_sql_database_instance.postgres.name
  name     = var.database_user
  password = random_password.db_password.result
}
