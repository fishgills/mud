# Slack App Manifest

This directory stores the Slack app manifest source of truth and environment
specific overrides. Use the CLI helper to render environment manifests for
upload into Slack.

## Files

- base.json: Shared manifest config.
- env/dev.json: Development overrides (e.g., display names).
- env/prod.json: Production overrides.
- app-ids.json: Slack app IDs for update commands.
- generated/: Output directory for rendered manifests.

## Usage

Render a development manifest:

```
yarn slack:manifest render --env dev
```

Render a production manifest (promotion):

```
yarn slack:manifest promote
```

Update Slack directly with the rendered manifest (requires app management token):

```
yarn slack:manifest:update:dev --app-id <app_id>
```

Promote to production:

```
yarn slack:manifest:update:prod --app-id <app_id>
```

Set `SLACK_MANIFEST_TOKEN` to avoid passing the token flag. App IDs are read from
`apps/slack-manifest/manifest/app-ids.json` by default.

You can set `SLACK_MANIFEST_TOKEN` in `apps/slack-manifest/.env` if you prefer a
tool-specific env file.

If your development bot uses a different request URL or redirect URL, add them
in `apps/slack/manifest/env/dev.json` to override the base values.
