# Mud

Mud is an AI-assisted multiplayer text adventure built as an Nx monorepo. The
workspace hosts the services that generate the procedural world, orchestrate
turn-based gameplay, and expose a Slack bot that players use to explore the
world together. The core services are written with NestJS, communicate over
GraphQL, and share a PostgreSQL + Redis backend through Prisma.

## Monorepo structure

| Path | Description |
| ---- | ----------- |
| `apps/world` | World generation and rendering service. Exposes GraphQL queries and REST rendering endpoints backed by Redis caching and Prisma. |
| `apps/dm` | "Dungeon master" API that drives game ticks, combat, and AI generated descriptions. Provides a GraphQL API consumed by the Slack bot. |
| `apps/slack-bot` | Slack Bolt app that handles player commands, maps, and onboarding through Slack conversations. |
| `apps/tick` | Lightweight worker that regularly calls the DM service to advance the world state. |
| `libs/database` | Shared Prisma client and schema for PostgreSQL. |
| `libs/gcp-auth` | Helpers for authenticating service-to-service calls on Google Cloud Run. |
| `infra/terraform` | Infrastructure-as-code definitions for deploying the services. |
| `scripts/` | Deployment and operational scripts (database migrations, certificate automation, etc.). |

Additional service-specific docs live alongside each app (for example
`apps/dm/SETUP.md`, `apps/dm/GAME_FLOW.md`, and `apps/world/TILE_OPERATIONS.md`).

## Prerequisites

* Node.js 20+ and npm 10+
* Docker (optional but recommended for local PostgreSQL and Redis)
* PostgreSQL 15+ (configured via `DATABASE_URL`)
* Redis 7+ (configured via `REDIS_URL`)
* OpenAI API key (for the DM service to synthesize descriptions)
* Slack workspace and app credentials (for the Slack bot)

## Environment variables

All services rely on the following shared configuration:

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `REDIS_URL` | Redis connection string used by the world renderer and DM caches. |

### DM service (`apps/dm`)

| Variable | Description |
| -------- | ----------- |
| `OPENAI_API_KEY` | API key used for AI descriptions and responses. |
| `WORLD_SERVICE_URL` | Base URL for the world service (e.g. `http://localhost:3001/world`). The DM app automatically appends `/graphql` when needed. |
| `COORDINATION_PREFIX` | Redis key namespace for coordination locks (defaults to `dm:coord:`). |
| `TILE_DESC_LOCK_TTL_MS` | TTL for tile description locks in Redis. |
| `TILE_DESC_COOLDOWN_MS` | Cooldown before retrying tile descriptions. |
| `TILE_DESC_MIN_RETRY_MS` | Minimum retry delay when description generation fails. |

### World service (`apps/world`)

| Variable | Description |
| -------- | ----------- |
| `CACHE_PREFIX` | Prefix for cached render artifacts. |
| `WORLD_RENDER_CACHE_TTL_MS` | Cache lifetime for rendered map tiles (milliseconds). |
| `WORLD_RENDER_COMPUTE_ON_THE_FLY` | When `true`, render missing tiles synchronously instead of requiring a warm cache. |

### Slack bot (`apps/slack-bot`)

| Variable | Description |
| -------- | ----------- |
| `SLACK_BOT_TOKEN` | Bot token for your Slack app. |
| `SLACK_SIGNING_SECRET` | Signing secret for request verification. |
| `SLACK_APP_TOKEN` | App-level token for the Bolt SDK. |
| `DM_GQL_ENDPOINT` | URL of the DM GraphQL endpoint (local default `http://localhost:3000/graphql`). |
| `WORLD_GQL_ENDPOINT` | URL of the world GraphQL endpoint (local default `http://localhost:3001/world/graphql`). |
| `WORLD_BASE_URL` | Base REST URL for rendered assets (local default `http://localhost:3001/world`). |
| `PORT` | Port the Slack bot listens on (default `3002`). |

### Tick worker (`apps/tick`)

| Variable | Description |
| -------- | ----------- |
| `DM_GRAPHQL_URL` | GraphQL endpoint that exposes the `processTick` mutation (local default `http://localhost:3000/graphql`). |
| `PORT` | HTTP port for the lightweight health server (default `3003`). |

The shared `@mud/gcp-auth` utilities also look for the `GCP_CLOUD_RUN` or
`K_SERVICE` environment variables to determine when to mint Cloud Run identity
tokens automatically.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start PostgreSQL and Redis (via Docker or your preferred installation). For
   Docker you can run:
   ```bash
   docker compose up -d postgres redis
   ```
3. Apply the Prisma schema to your database:
   ```bash
   npx prisma migrate deploy --schema=libs/database/prisma/schema.prisma
   ```
4. Export or define the environment variables described above. One convenient
   approach for local development is to create a `.env.local` file and use
   `npx dotenv -e .env.local -- <command>` when running Nx tasks.

## Running the services locally

Run each service in its own terminal (or use Nx's run-many support):

```bash
# World generation service (GraphQL on http://localhost:3001/world/graphql)
npx nx serve world

# DM GraphQL API (http://localhost:3000/graphql)
npx nx serve dm

# Slack bot (requires Slack credentials)
npx nx serve slack-bot

# Tick worker (advances the simulation every 30 seconds)
npx nx serve tick
```

The Slack bot registers handlers for mentions and direct messages. Once the DM
and world services are online you can invite the bot to a channel and issue
commands such as `new`, `north`, `look`, `attack`, and `map` to explore the
world.

## Development workflows

* **GraphQL code generation** – Regenerate typed GraphQL clients when schemas
  change:
  ```bash
  npx nx run dm:codegen
  npx nx run slack-bot:codegen
  ```
* **Testing** – Run Jest unit tests per project:
  ```bash
  npx nx test dm
  npx nx test world
  npx nx test slack-bot
  npx nx test tick
  ```
  The DM service also ships an integration harness: `./apps/dm/test-dm.sh`.
* **Linting** – Check code style with ESLint:
  ```bash
  npx nx lint dm
  ```
* **Database changes** – Update the Prisma schema in
  `libs/database/prisma/schema.prisma` and run `npx prisma migrate dev` (for
  local development) followed by `npx prisma generate` if you add new models.

## Deployment

This repository includes Dockerfiles for each service and Terraform modules for
GCP deployments. The `scripts/` directory contains helper scripts such as
`scripts/deploy.py` for rolling out migrations and managing Cloud Run services,
and `init-letsencrypt.sh` for provisioning HTTPS certificates when using the
provided `docker-compose.yml` + Nginx setup.

## Contributing

Issues and pull requests are welcome! Please ensure code is formatted with the
project's ESLint/Prettier configuration and that relevant tests pass before
submitting changes.

## License

Mud is released under the MIT license.
