# Copilot instructions for this repo

Purpose: Equip AI coding agents to be productive in this Nx monorepo with minimal context. Prefer small, surgical changes that fit existing patterns and run via Nx.

## Architecture (big picture)

- Nx (v21) monorepo.
  - apps/world: NestJS GraphQL service (map/tile rendering). Depends on libs/database.
  - apps/dm: NestJS service for game logic. Uses libs/database and queries world via GraphQL.
  - apps/slack-bot: Slack Bolt JS bot calling dm/world via GraphQL.
  - apps/tick: tick/utility app.
  - libs/database: Prisma client + shared schema/types.
  - libs/gcp-auth: Cloud Run ID token auth helper (injects Authorization header when in GCP).
- Flow: Slack user → slack-bot → GraphQL → dm/world. dm persists via Prisma and reads world tiles.

## Run/build with Nx (use targets, not raw scripts)

- Serve: `nx serve @mud/world`, `nx serve @mud/dm`, `nx serve slack-bot`
- Build: `nx build @mud/world`, `nx build @mud/dm`, `nx build slack-bot`
- Codegen: `nx run @mud/dm:codegen`, `nx run slack-bot:codegen`
- world/dm build via webpack-cli; slack-bot via @nx/esbuild.

## Env & auth patterns

- Env is validated with envalid (dotenv only in slack-bot). Key vars:
  - slack-bot: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SLACK_APP_TOKEN, DM_GQL_ENDPOINT (default http://localhost:3001/graphql), WORLD_GQL_ENDPOINT (default http://localhost:3000/graphql), PORT (3002)
  - dm: OPENAI_API_KEY, DATABASE_URL, WORLD_SERVICE_URL (http://localhost:3000/api), REDIS_URL
  - world: DATABASE*URL, REDIS_URL, WORLD_RENDER*\* flags
- Cloud Run auth: `authorizedFetch` (libs/gcp-auth) injects ID token only in GCP (K_SERVICE or GCP_CLOUD_RUN=true). Localhost is a no‑op. Use it as the fetch for GraphQL clients.

## GraphQL conventions

- Root schemas at repo root: `world-schema.gql`, `dm-schema.gql`. Per-app `codegen.ts` generates typed SDKs under `apps/*/src/generated/*`.
- Client example: `apps/slack-bot/src/gql-client.ts` uses `authorizedFetch` and `ensureGraphQLEndpoint` to force `/graphql`.
- Prefer generated `getSdk` functions over handwritten fetch calls.

## Slack bot patterns

- Centralize commands/action IDs in `apps/slack-bot/src/commands.ts`.
- Handlers in `apps/slack-bot/src/handlers/*` register themselves via `registerHandler(command, fn)` (see `handlerRegistry.ts`). `main.ts` dispatches based on text, passing `{ userId, text, say }`.
- `SayMessage` supports `fileUpload` to send images (map PNGs). Movement uses generated `Direction` enum and sends a PNG + short text.

## Database (libs/database)

- Use the singleton `getPrismaClient()`; do not instantiate PrismaClient elsewhere. Migrations live in `libs/database/prisma/migrations`.

## Local dev defaults

- world: http://localhost:3000, dm: http://localhost:3001, slack-bot: :3002. `supergraph.yaml` references world/dm schemas for composition during dev.

## Adding features (follow these steps)

- Slack command: add constant to `commands.ts` → create handler in `apps/slack-bot/src/handlers/<name>.ts` → call `registerHandler` at bottom.
- GraphQL change: update root `*-schema.gql` → run the app’s `:codegen` → implement using generated types.
- Shared logic: prefer libs (`authorizedFetch`, `ensureGraphQLEndpoint`, `getPrismaClient`).

## Key files

- `apps/slack-bot/src/gql-client.ts`, `apps/slack-bot/src/handlers/*`
- `apps/dm/src/**` (Nest app bootstrap in `src/main.ts`)
- `apps/world/src/**` (render + GraphQL resolvers)
- `libs/gcp-auth/src/lib/gcp-auth.ts` (Cloud Run auth)
- `libs/database/**` (Prisma client and schema)

Questions or unclear areas? Ask and we’ll expand this doc with concrete examples from the codebase.
