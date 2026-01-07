resource "google_dns_record_set" "public_ingress" {
  for_each = {
    slack = local.domain_mappings.slack
    world = local.domain_mappings.world
    web   = local.domain_mappings.web
    www   = local.domain_mappings.www
  }

  name         = "${each.value}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.gke_ingress.address]
}
