resource "google_dns_record_set" "public_ingress" {
  for_each = {
    slack_bot = local.domain_mappings.slack_bot
    world     = local.domain_mappings.world
  }

  name         = "${each.value}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "A"
  ttl          = 300

  rrdatas = [google_compute_global_address.gke_ingress.address]
}
