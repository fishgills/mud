# Local values for filtering services
locals {
  # All services
  all_services = var.services

  # Only enabled services
  enabled_services = {
    for k, v in var.services : k => v
    if try(coalesce(v.enabled, true), true)
  }

  datadog_site = var.datadog_site

  # Only external services (exclude internal ones)
  external_services = {
    for k, v in local.enabled_services : k => v
    if !try(coalesce(v.internal, false), false)
  }

  # Precomputed URLs for services
  # - run.app alias uses the Cloud Run default hostname for the service name (mud-<name>-<project#>.<region>.run.app)
  # - domain URL uses the pretty DNS name (<name>.<domain>)
  # - preferred URL chooses domain for external services and run.app alias for internal ones
  service_runapp_alias = {
    for k, v in local.enabled_services :
    k => "https://mud-${v.name}-${data.google_project.project.number}.${var.region}.run.app"
  }

  service_domain_url = {
    for k, v in local.enabled_services :
    k => "https://${v.name}.${var.domain}"
  }

  service_preferred_url = {
    for k, v in local.enabled_services :
    k => (try(coalesce(v.internal, false), false) ? local.service_runapp_alias[k] : local.service_domain_url[k])
  }
}
