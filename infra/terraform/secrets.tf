locals {
  provided_secret_ids = {
    openai               = "openai-api-key"
    slack_bot_token      = "slack-bot-token"
    slack_signing_secret = "slack-signing-secret"
    slack_app_token      = "slack-app-token"
    slack_client_id      = "slack-client-id"
    slack_client_secret  = "slack-client-secret"
    slack_state_secret   = "slack-state-secret"
  }

  provided_secret_values = {
    openai               = var.openai_api_key
    slack_bot_token      = var.slack_bot_token
    slack_signing_secret = var.slack_signing_secret
    slack_app_token      = var.slack_app_token
    slack_client_id      = var.slack_client_id
    slack_client_secret  = var.slack_client_secret
    slack_state_secret   = var.slack_state_secret
  }

  provided_secrets_with_values = nonsensitive({
    for key, secret_id in local.provided_secret_ids :
    key => secret_id
    if local.provided_secret_values[key] != null
  })

  db_password_urlencoded = urlencode(random_password.db_password.result)
  database_url           = "postgresql://${var.database_user}:${local.db_password_urlencoded}@localhost/${var.database_name}?host=/cloudsql/${google_sql_database_instance.postgres.connection_name}&schema=public"
}

resource "google_secret_manager_secret" "provided" {
  for_each = local.provided_secret_ids

  secret_id = each.value
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "provided" {
  for_each = local.provided_secrets_with_values

  secret      = google_secret_manager_secret.provided[each.key].id
  secret_data = local.provided_secret_values[each.key]
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = local.database_url
}

resource "google_secret_manager_secret" "database_password" {
  secret_id = "database-password"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_password" {
  secret      = google_secret_manager_secret.database_password.id
  secret_data = random_password.db_password.result
}
