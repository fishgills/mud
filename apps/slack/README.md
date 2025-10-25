# Slack Bot

This is a Slack bot for the MUD game, built with Slack Bolt JS. It interacts with the DM and World services via REST APIs.

## Setup

- Install dependencies: `npm install`
- Configure Slack credentials in environment variables
- Run the bot: `nx serve bot`

## Features

- Player creation and rerolling stats
- Movement and attack commands
- Interacts with DM and World services using REST endpoints

## OAuth installation (optional)

The bot can run with a single-workspace bot token, or you can enable OAuth multi-workspace installs backed by Prisma.

Set these env vars to enable OAuth and the Prisma installation store:

- SLACK_CLIENT_ID
- SLACK_CLIENT_SECRET
- SLACK_STATE_SECRET

Scopes are now hard-coded in code. Current scopes required by the app:

- app_mentions:read
- chat:write
- files:write
- im:history
- im:read
- im:write
- users:read

When enabled, visit /slack/install to add the app to a workspace.

Notes:

- The OAuth redirect is handled by Bolt at /slack/oauth_redirect by default. A custom SLACK_REDIRECT_URI is no longer required.
