###############################################
# Cloud Run Domain Mapping (public service only)
###############################################

resource "google_cloud_run_domain_mapping" "slack_bot" {
  location = var.region
  name     = "slack-bot.${var.domain}"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.services["slack-bot"].name
  }

  depends_on = [google_cloud_run_v2_service.services]
}

resource "google_dns_record_set" "slack_bot_domain_mapping" {
  managed_zone = data.google_dns_managed_zone.zone.name
  name         = "${google_cloud_run_domain_mapping.slack_bot.name}."
  type         = "CNAME"
  ttl          = 300

  rrdatas = [google_cloud_run_domain_mapping.slack_bot.status[0].resource_records[0].rrdata]
}
