# SSL Certificate for Load Balancer (optional)
resource "google_compute_managed_ssl_certificate" "ssl_cert" {
  count = var.enable_load_balancer ? 1 : 0
  name  = "mud-ssl-cert"

  managed {
    domains = [
      for service_key, service in local.external_services : "${service.name}.${var.domain}"
    ]
  }

  depends_on = [google_project_service.apis]
}

# Global Load Balancer (optional)
resource "google_compute_global_address" "default" {
  count = var.enable_load_balancer ? 1 : 0
  name  = "mud-lb-ip"
}

resource "google_compute_url_map" "default" {
  count           = var.enable_load_balancer ? 1 : 0
  name            = "mud-url-map"
  default_service = var.enable_load_balancer ? values(google_compute_backend_service.services)[0].id : null

  dynamic "host_rule" {
    for_each = var.enable_load_balancer ? local.external_services : {}
    content {
      hosts        = ["${host_rule.value.name}.${var.domain}"]
      path_matcher = "path-matcher-${host_rule.value.name}"
    }
  }

  dynamic "path_matcher" {
    for_each = var.enable_load_balancer ? local.external_services : {}
    content {
      name            = "path-matcher-${path_matcher.value.name}"
      default_service = google_compute_backend_service.services[path_matcher.key].id
    }
  }
}

resource "google_compute_backend_service" "services" {
  for_each = var.enable_load_balancer ? local.external_services : {}

  name        = "mud-${each.value.name}-backend"
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.services[each.key].id
  }
}

resource "google_compute_region_network_endpoint_group" "services" {
  for_each = var.enable_load_balancer ? local.enabled_services : {}

  name                  = "mud-${each.value.name}-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.services[each.key].name
  }
}

resource "google_compute_target_https_proxy" "default" {
  count            = var.enable_load_balancer ? 1 : 0
  name             = "mud-https-proxy"
  url_map          = google_compute_url_map.default[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.ssl_cert[0].id]
}

resource "google_compute_url_map" "https_redirect" {
  count = var.enable_load_balancer ? 1 : 0
  name  = "mud-https-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "https_redirect" {
  count   = var.enable_load_balancer ? 1 : 0
  name    = "mud-http-proxy"
  url_map = google_compute_url_map.https_redirect[0].id
}

resource "google_compute_global_forwarding_rule" "https" {
  count      = var.enable_load_balancer ? 1 : 0
  name       = "mud-https-forwarding-rule"
  target     = google_compute_target_https_proxy.default[0].id
  port_range = "443"
  ip_address = google_compute_global_address.default[0].address
}

resource "google_compute_global_forwarding_rule" "http" {
  count      = var.enable_load_balancer ? 1 : 0
  name       = "mud-http-forwarding-rule"
  target     = google_compute_target_http_proxy.https_redirect[0].id
  port_range = "80"
  ip_address = google_compute_global_address.default[0].address
}

resource "google_dns_record_set" "services" {
  for_each = var.enable_load_balancer ? { for k, v in local.external_services : k => v if !contains(var.dns_skip, k) } : {}

  name = "${each.value.name}.${data.google_dns_managed_zone.zone.dns_name}"
  type = "A"
  ttl  = 300

  managed_zone = data.google_dns_managed_zone.zone.name

  rrdatas = [google_compute_global_address.default[0].address]
}
