# Mud

Mud is an AI-assisted multiplayer text adventure game built as a Turborepo monorepo. It features procedurally generated worlds, turn-based gameplay, and a Slack bot interface for player interaction. The core services are written with NestJS, communicate over RESTful HTTP APIs, and share a PostgreSQL + Redis backend through Prisma.

## Monorepo structure

| Path                         | Description                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/world`                 | World generation and rendering service providing REST endpoints backed by Redis caching and Prisma.                               |
| `apps/dm`                    | \"Dungeon master\" API that drives game ticks, combat, and AI generated descriptions. Exposes REST endpoints consumed by clients. |
| `apps/slack`                 | Slack Bolt app that handles player commands, maps, and onboarding through Slack conversations.                                    |
| `apps/tick`                  | Lightweight worker that regularly calls the DM service to advance the world state.                                                |
| `libs/database`              | Shared Prisma client and schema for PostgreSQL.                                                                                   |
| `libs/engine`                | Client-agnostic game engine with entity management (Players, Monsters, NPCs) and factory patterns.                                |
| `libs/event-bus`             | Process-wide EventBus for event-driven communication within services.                                                             |
| `libs/redis-client`          | Redis-based event bridge for cross-service pub/sub messaging and notifications.                                                   |
| `libs/logging`               | Shared Pino-based logging library with NestJS integration.                                                                        |
| `libs/constants`             | Shared constants and enumerations used across services.                                                                           |
| `libs/api-contracts`         | Shared TypeScript types and interfaces for API contracts.                                                                         |
| `libs/tracer`                | Datadog APM tracing integration for observability.                                                                                |
| `libs/eslint-config`         | Shared ESLint configuration for consistent code style.                                                                            |
| `libs/typescript-config`     | Shared TypeScript configuration base.                                                                                             |
| `infra/terraform`            | Infrastructure-as-code definitions for GKE cluster, Cloud SQL, Redis, networking, and Kubernetes resources.                       |
| `infra/terraform/kubernetes` | Kubernetes-specific Terraform resources (deployments, services, ingress, secrets).                                                |
| `scripts/`                   | Deployment and operational scripts (database migrations, certificate automation, etc.).                                           |

Additional service-specific docs live alongside each app (for example
`apps/dm/SETUP.md`, `apps/dm/GAME_FLOW.md`, and `apps/world/TILE_OPERATIONS.md`).

## Event-driven architecture

The system uses a two-tier event architecture:

### Process-wide EventBus (`@mud/event-bus`)

The `@mud/event-bus` package provides a process-wide `EventBus` for communication within a service. Modules within `apps/dm` emit game events (player movement, combat, notifications, etc.) through the bus instead of calling one another directly. This keeps features decoupled.

- Emit events with `EventBus.emit({ eventType, ...payload })` anywhere inside the DM service. Existing systems like `PlayerService`, `CombatService`, and encounter handling already follow this pattern.
- Subscribe to events with `EventBus.on('player:move', handler)` or `EventBus.onAny(handler)` when building reactive components (for example, tile prefetch or AI behaviors).

### Cross-service EventBridge (`@mud/redis-client`)

For communication between services (DM ↔ Slack, DM ↔ World), the `EventBridgeService` in `apps/dm` forwards emitted events to Redis through the `@mud/redis-client` bridge. Other apps subscribe on Redis channels and receive the same payloads.

- Channel-based routing: `notifications:slack`, `notifications:discord`
- Notification types: combat, monster, player, world events
- Multi-workspace support for Slack

When adding new DM features, always publish significant state changes through the EventBus so downstream listeners and external clients stay in sync.

## Prerequisites

- Node.js 20+
- Yarn 1.22+ (package manager)
- Docker (optional but recommended for local PostgreSQL and Redis)
- PostgreSQL 15+ (configured via `DATABASE_URL`)
- Redis 7+ (configured via `REDIS_URL`)
- OpenAI API key (for the DM service to synthesize descriptions)
- Slack workspace and app credentials (for the Slack bot)

## Environment variables

All services rely on the following shared configuration:

| Variable       | Description                                                       |
| -------------- | ----------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma.                      |
| `REDIS_URL`    | Redis connection string used by the world renderer and DM caches. |

### DM service (`apps/dm`)

| Variable                 | Description                                                                   |
| ------------------------ | ----------------------------------------------------------------------------- |
| `OPENAI_API_KEY`         | API key used for AI descriptions and responses.                               |
| `WORLD_SERVICE_URL`      | Base URL for the world service (e.g. `https://closet.battleforge.app/world`). |
| `COORDINATION_PREFIX`    | Redis key namespace for coordination locks (defaults to `dm:coord:`).         |
| `TILE_DESC_LOCK_TTL_MS`  | TTL for tile description locks in Redis.                                      |
| `TILE_DESC_COOLDOWN_MS`  | Cooldown before retrying tile descriptions.                                   |
| `TILE_DESC_MIN_RETRY_MS` | Minimum retry delay when description generation fails.                        |

### World service (`apps/world`)

| Variable                          | Description                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `CACHE_PREFIX`                    | Prefix for cached render artifacts.                                                |
| `WORLD_RENDER_CACHE_TTL_MS`       | Cache lifetime for rendered map tiles (milliseconds).                              |
| `WORLD_RENDER_COMPUTE_ON_THE_FLY` | When `true`, render missing tiles synchronously instead of requiring a warm cache. |

### Slack bot (`apps/slack`)

| Variable               | Description                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`      | Bot token for your Slack app.                                                          |
| `SLACK_SIGNING_SECRET` | Signing secret for request verification.                                               |
| `SLACK_APP_TOKEN`      | App-level token for the Bolt SDK.                                                      |
| `DM_API_BASE_URL`      | Base URL of the DM REST API (local default `http://localhost:3000/dm`).                |
| `WORLD_API_BASE_URL`   | Base URL of the world REST API (local default `https://closet.battleforge.app/world`). |
| `PORT`                 | Port the Slack bot listens on (default `3002`).                                        |

### Tick worker (`apps/tick`)

| Variable          | Description                                                             |
| ----------------- | ----------------------------------------------------------------------- |
| `DM_API_BASE_URL` | Base URL of the DM REST API (local default `http://localhost:3000/dm`). |
| `PORT`            | HTTP port for the lightweight health server (default `3003`).           |

Services communicate using standard HTTP fetch calls. When running on GKE, internal service-to-service traffic is unauthenticated and uses Kubernetes DNS for service discovery.

## Getting started

1. Install dependencies:
   ```bash
   yarn install
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
4. Generate Prisma client:
   ```bash
   npx prisma generate --schema=libs/database/prisma/schema.prisma
   ```
5. Export or define the environment variables described above. One convenient
   approach for local development is to create a `.env.local` file in each app
   directory or use environment variable management tools.

## Running the services locally

Run each service in its own terminal (or use Turbo's parallel execution):

```bash
# Start all services
yarn serve

# Or run individual services:
# World generation service REST API (https://closet.battleforge.app/world)
yarn turbo run serve --filter=@mud/world

# DM REST API (http://localhost:3000/dm)
yarn turbo run serve --filter=@mud/dm

# Slack bot (requires Slack credentials)
yarn turbo run serve --filter=@mud/slack

# Tick worker (advances the simulation every 30 seconds)
yarn turbo run serve --filter=@mud/tick
```

The Slack bot registers handlers for mentions and direct messages. Once the DM
and world services are online you can invite the bot to a channel and issue
commands such as `new`, `north`, `look`, `attack`, and `map` to explore the
world.

## Development workflows

- **Testing** – Run Jest unit tests:

  ```bash
  # Run all tests
  yarn test

  # Run tests for specific app
  yarn turbo run test --filter=@mud/dm
  yarn turbo run test --filter=@mud/world
  yarn turbo run test --filter=@mud/slack
  yarn turbo run test --filter=@mud/tick
  ```

  The DM service also ships an integration harness: `./apps/dm/test-dm.sh`.

- **Linting** – Check code style with ESLint:
  ```bash
  yarn lint
  ```
- **Building** – Build all apps or specific ones:

  ```bash
  # Build all apps
  yarn build

  # Build specific app
  yarn turbo run build --filter=@mud/dm
  ```

- **Formatting** – Format code with Prettier:
  ```bash
  yarn format
  ```
- **Database changes** – Update the Prisma schema in
  `libs/database/prisma/schema.prisma` and run:

  ```bash
  # For local development
  npx prisma migrate dev --schema=libs/database/prisma/schema.prisma

  # Generate Prisma client after schema changes
  npx prisma generate --schema=libs/database/prisma/schema.prisma

  # For production
  yarn db:migrate:deploy
  ```

## Deployment

Production runs on Google Kubernetes Engine (GKE). Terraform (in `infra/terraform`) manages
all infrastructure: the GKE cluster, Kubernetes workloads (Deployments/Services/Ingress), Cloud SQL (PostgreSQL), Memorystore
(Redis), Artifact Registry, Secret Manager, networking, and custom domains. The
legacy single-VPS deployment has been removed.

### Pipeline

`.github/workflows/deploy.yml` builds Docker images for all four services on
every push to `main`, pushes them to Artifact Registry, and then runs
`terraform apply` with commit-specific image tags. The workflow authenticates to
Google Cloud via Workload Identity Federation and uses the `Production`
environment so secrets stay scoped.

Populate the following GitHub environment secrets before enabling the workflow:

- `GCP_DEPLOY_SA`, `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_PROJECT_ID`, `GCP_REGION`
- `TF_BACKEND_BUCKET`, `TF_BACKEND_PREFIX`
- `OPENAI_API_KEY`
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_STATE_SECRET`

DNS for `slack.battleforge.app` and `world.battleforge.app` is created by
Terraform as A records that point at the shared GKE HTTP(S) load balancer. Certificates
are provisioned automatically via the GKE ManagedCertificate resource.

### Manual Terraform runs

To run Terraform locally, create `backend.hcl` with your state bucket and
prefix, then execute:

```bash
cd infra/terraform
terraform init -backend-config=backend.hcl
terraform plan
terraform apply
```

Supply the same `TF_VAR_*` variables as the deploy workflow (for example,
`dm_image`, Slack/OpenAI secrets) when applying changes.

### Available Scripts

| Script                   | Description                            |
| ------------------------ | -------------------------------------- |
| `yarn build`             | Build all apps                         |
| `yarn test`              | Run all tests                          |
| `yarn serve`             | Start all development servers          |
| `yarn lint`              | Lint all code                          |
| `yarn format`            | Format code with Prettier              |
| `yarn db:migrate:dev`    | Run Prisma migrations (development)    |
| `yarn db:migrate:deploy` | Run Prisma migrations (production)     |
| `yarn db:push`           | Push schema changes without migrations |
| `yarn db:seed`           | Seed database with initial data        |

### Turborepo Features

This project uses Turborepo for:

- **Task caching** – Speeds up builds and tests by caching results
- **Parallel execution** – Runs tasks across packages simultaneously
- **Dependency awareness** – Executes tasks in the correct order based on package dependencies
- **Remote caching** – Can be configured to share cache across team members

## Contributing

Issues and pull requests are welcome! Please ensure code is formatted with the
project's ESLint/Prettier configuration and that relevant tests pass before
submitting changes.

## License

Mud is released under the MIT license.
