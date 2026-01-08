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

resource "google_dns_record_set" "purelymail_mx" {
  name         = "${var.domain}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "MX"
  ttl          = 300

  rrdatas = ["10 mailserver.purelymail.com."]
}

resource "google_dns_record_set" "purelymail_txt" {
  name         = "${var.domain}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "TXT"
  ttl          = 300

  rrdatas = [
    "\"v=spf1 include:_spf.purelymail.com ~all\"",
    "\"purelymail_ownership_proof=c78efa9bf474e85eb3454a213a56f77c4542aa5843dd792b41179d9bf6eb235c59d85bd2f3865a3e56add311360607d741fc495c2210d8b9d67446ac910a9c9c\"",
  ]
}

resource "google_dns_record_set" "purelymail_dkim1" {
  name         = "purelymail1._domainkey.${var.domain}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "CNAME"
  ttl          = 300

  rrdatas = ["key1.dkimroot.purelymail.com."]
}

resource "google_dns_record_set" "purelymail_dkim2" {
  name         = "purelymail2._domainkey.${var.domain}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "CNAME"
  ttl          = 300

  rrdatas = ["key2.dkimroot.purelymail.com."]
}

resource "google_dns_record_set" "purelymail_dkim3" {
  name         = "purelymail3._domainkey.${var.domain}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "CNAME"
  ttl          = 300

  rrdatas = ["key3.dkimroot.purelymail.com."]
}

resource "google_dns_record_set" "purelymail_dmarc" {
  name         = "_dmarc.${var.domain}."
  managed_zone = data.google_dns_managed_zone.zone.name
  type         = "CNAME"
  ttl          = 300

  rrdatas = ["dmarcroot.purelymail.com."]
}
