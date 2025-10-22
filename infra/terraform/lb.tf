// Create a Google HTTPS Load Balancer that fronts the single VPS.
// This uses a Google-managed certificate (not exportable) and an Internet NEG
// that points to the VPS external IP so traffic is proxied to the VM.

locals {
  lb_domains      = concat([var.domain], var.additional_hostnames)
  lb_domains_hash = substr(md5(join(",", sort(local.lb_domains))), 0, 16)
}

resource "google_compute_global_address" "lb_ip" {
  name = "mud-lb-ip"
}

resource "google_compute_managed_ssl_certificate" "managed_cert" {
  name = "mud-managed-cert-${local.lb_domains_hash}"

  lifecycle {
    create_before_destroy = true
  }

  managed {
    # Use the primary domain plus any additional hostnames defined in variables.tf
    domains = local.lb_domains
  }
}

resource "google_compute_health_check" "http" {
  name = "mud-health-check"

  http_health_check {
    port         = 80
    request_path = "/healthz"
    proxy_header = "NONE"
  }
}

// slack-specific health check removed - the LB will check the HTTP port on the
// instance and let Nginx perform internal routing to containers.

# Network endpoint group pointing to a single external IP (the VPS)
resource "google_compute_instance_group" "vps_ig" {
  name = "vps-instance-group"
  zone = var.zone

  instances = [google_compute_instance.vps.self_link]

  named_port {
    name = "http"
    port = 80
  }

  # slack named port removed - Nginx handles routing from port 80 to containers
}

resource "google_compute_backend_service" "vps_backend" {
  name          = "vps-backend"
  protocol      = "HTTP"
  port_name     = "http"
  timeout_sec   = 30
  health_checks = [google_compute_health_check.http.self_link]

  backend {
    group = google_compute_instance_group.vps_ig.self_link
  }
}

// slack backend removed; Nginx on the VPS will route /slack requests to the
// slack-bot container internally.

# URL map that forwards HTTPS requests to the backend service
resource "google_compute_url_map" "https_map" {
  name = "mud-https-map"
  host_rule {
    hosts        = local.lb_domains
    path_matcher = "path-matcher-1"
  }

  # Default service for requests that don't match any host/path rules
  default_service = google_compute_backend_service.vps_backend.self_link

  path_matcher {
    name            = "path-matcher-1"
    default_service = google_compute_backend_service.vps_backend.self_link

    # Let the VPS's Nginx handle /slack routing internally; LB will forward
    # all requests to the VPS HTTP backend.
  }
}

# URL map for HTTP that redirects to HTTPS
resource "google_compute_url_map" "http_redirect_map" {
  name = "mud-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_https_proxy" "https_proxy" {
  name             = "mud-https-proxy"
  url_map          = google_compute_url_map.https_map.self_link
  ssl_certificates = [google_compute_managed_ssl_certificate.managed_cert.id]
}

resource "google_compute_target_http_proxy" "http_proxy" {
  name    = "mud-http-proxy"
  url_map = google_compute_url_map.http_redirect_map.self_link
}

resource "google_compute_global_forwarding_rule" "https_forward" {
  name       = "mud-https-forward"
  ip_address = google_compute_global_address.lb_ip.address
  port_range = "443"
  target     = google_compute_target_https_proxy.https_proxy.self_link
}

resource "google_compute_global_forwarding_rule" "http_forward" {
  name       = "mud-http-forward"
  ip_address = google_compute_global_address.lb_ip.address
  port_range = "80"
  target     = google_compute_target_http_proxy.http_proxy.self_link
}

output "lb_ip_address" {
  value = google_compute_global_address.lb_ip.address
}
