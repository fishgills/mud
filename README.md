# Mud

Mud is an AI-assisted multiplayer text adventure game built as a Turborepo monorepo. It features procedurally generated worlds, turn-based gameplay, and a Slack bot interface for player interaction. The core services are written with NestJS, communicate over RESTful HTTP APIs, and share a PostgreSQL + Redis backend through Prisma.

## Monorepo structure

| Path              | Description                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/world`      | World generation and rendering service providing REST endpoints backed by Redis caching and Prisma.                                  |
| `apps/dm`         | \"Dungeon master\" API that drives game ticks, combat, and AI generated descriptions. Exposes REST endpoints consumed by clients.   |
| `apps/slack-bot`  | Slack Bolt app that handles player commands, maps, and onboarding through Slack conversations.                                        |
| `apps/tick`       | Lightweight worker that regularly calls the DM service to advance the world state.                                                    |
| `libs/database`   | Shared Prisma client and schema for PostgreSQL.                                                                                       |
| `libs/gcp-auth`   | Helpers for authenticating service-to-service calls on Google Cloud Run.                                                              |
| `infra/terraform` | Infrastructure-as-code definitions for deploying the services.                                                                        |
| `scripts/`        | Deployment and operational scripts (database migrations, certificate automation, etc.).                                               |

Additional service-specific docs live alongside each app (for example
`apps/dm/SETUP.md`, `apps/dm/GAME_FLOW.md`, and `apps/world/TILE_OPERATIONS.md`).

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

| Variable                 | Description                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`         | API key used for AI descriptions and responses.                                                                               |
| `WORLD_SERVICE_URL`      | Base URL for the world service (e.g. `http://localhost:3001/world`).                                                          |
| `COORDINATION_PREFIX`    | Redis key namespace for coordination locks (defaults to `dm:coord:`).                                                         |
| `TILE_DESC_LOCK_TTL_MS`  | TTL for tile description locks in Redis.                                                                                      |
| `TILE_DESC_COOLDOWN_MS`  | Cooldown before retrying tile descriptions.                                                                                   |
| `TILE_DESC_MIN_RETRY_MS` | Minimum retry delay when description generation fails.                                                                        |

### World service (`apps/world`)

| Variable                          | Description                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `CACHE_PREFIX`                    | Prefix for cached render artifacts.                                                |
| `WORLD_RENDER_CACHE_TTL_MS`       | Cache lifetime for rendered map tiles (milliseconds).                              |
| `WORLD_RENDER_COMPUTE_ON_THE_FLY` | When `true`, render missing tiles synchronously instead of requiring a warm cache. |

### Slack bot (`apps/slack-bot`)

| Variable               | Description                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `SLACK_BOT_TOKEN`      | Bot token for your Slack app.                                                            |
| `SLACK_SIGNING_SECRET` | Signing secret for request verification.                                                 |
| `SLACK_APP_TOKEN`      | App-level token for the Bolt SDK.                                                        |
| `DM_API_BASE_URL`      | Base URL of the DM REST API (local default `http://localhost:3000`).                     |
| `WORLD_API_BASE_URL`   | Base URL of the world REST API (local default `http://localhost:3001/world`).            |
| `PORT`                 | Port the Slack bot listens on (default `3002`).                                          |

### Tick worker (`apps/tick`)

| Variable         | Description                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `DM_API_BASE_URL` | Base URL of the DM REST API (local default `http://localhost:3000`). |
| `PORT`           | HTTP port for the lightweight health server (default `3003`).                                             |

The shared `@mud/gcp-auth` utilities also look for the `GCP_CLOUD_RUN` or
`K_SERVICE` environment variables to determine when to mint Cloud Run identity
tokens automatically.

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
# World generation service REST API (http://localhost:3001/world)
yarn turbo run serve --filter=@mud/world

# DM REST API (http://localhost:3000)
yarn turbo run serve --filter=@mud/dm

# Slack bot (requires Slack credentials)
yarn turbo run serve --filter=@mud/slack-bot

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
  yarn turbo run test --filter=@mud/slack-bot
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

This repository includes Dockerfiles for each service and Terraform modules for
GCP deployments. The `scripts/` directory contains helper scripts such as
`scripts/deploy.py` for rolling out migrations and managing Cloud Run services,
and `init-letsencrypt.sh` for provisioning HTTPS certificates when using the
provided `docker-compose.yml` + Nginx setup.

### Available Scripts

| Script                   | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `yarn build`             | Build all apps                                 |
| `yarn test`              | Run all tests                                  |
| `yarn serve`             | Start all development servers                  |
| `yarn lint`              | Lint all code                                  |
| `yarn format`            | Format code with Prettier                      |
| `yarn db:migrate:dev`    | Run Prisma migrations (development)            |
| `yarn db:migrate:deploy` | Run Prisma migrations (production)             |
| `yarn db:push`           | Push schema changes without migrations         |
| `yarn db:seed`           | Seed database with initial data                |

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
