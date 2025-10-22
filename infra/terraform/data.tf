# Get existing DNS zone
data "google_dns_managed_zone" "zone" {
  name = var.dns_zone_name
}
