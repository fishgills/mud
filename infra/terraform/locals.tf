# Local values for filtering services
locals {
  # All services
  all_services = var.services

  # Only enabled services
  enabled_services = {
    for k, v in var.services : k => v
    if try(coalesce(v.enabled, true), true)
  }

  # Only external services (exclude internal ones)
  external_services = {
    for k, v in local.enabled_services : k => v
    if !try(coalesce(v.internal, false), false)
  }
}
