# Slack Bot

This is a Slack bot for the MUD game, built with Slack Bolt JS. It communicates with the DM and World services through shared ts-rest contracts backed by Zod schemas.

## Setup

- Install dependencies: `yarn install`
- Configure Slack credentials and service URLs in environment variables (`DM_SERVICE_URL`, `WORLD_SERVICE_URL`, `WORLD_RENDER_BASE_URL`)
- Run the bot: `yarn turbo run serve --filter=@mud/slack-bot`

## Features

- Player creation and rerolling stats
- Movement and attack commands
- Interacts with DM and World services using strongly typed REST APIs
