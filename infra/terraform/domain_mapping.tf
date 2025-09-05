###############################################
# Cloud Run Domain Mappings for external services
###############################################

# One domain mapping per external service (uses each.value.name as the subdomain)
resource "google_cloud_run_domain_mapping" "mapping" {
  for_each = local.external_services

  location = var.region
  name     = "${each.value.name}.${var.domain}"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.services[each.key].name
  }

  depends_on = [google_cloud_run_v2_service.services]
}

# Create DNS CNAME records for domain mappings unless the service key is in var.dns_skip
resource "google_dns_record_set" "domain_mapping" {
  for_each = local.external_services

  managed_zone = data.google_dns_managed_zone.zone.name
  name         = "${google_cloud_run_domain_mapping.mapping[each.key].name}."
  type         = "CNAME"
  ttl          = 300

  rrdatas = [google_cloud_run_domain_mapping.mapping[each.key].status[0].resource_records[0].rrdata]
}

