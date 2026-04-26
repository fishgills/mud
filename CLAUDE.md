# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->

## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Build & Test

```bash
# Install dependencies
yarn install

# Build all packages (required before running tests for the first time)
yarn build

# Run all tests (no live services needed — DB and Redis are mocked)
yarn test

# Run tests for a single app
yarn turbo run test --filter=@mud/slack
yarn turbo run test --filter=@mud/dm

# Lint
yarn lint

# Format
yarn format

# Regenerate Prisma client
yarn generate

# DB migrations (requires live PG)
yarn db:migrate:dev
```

## Architecture Overview

Turborepo monorepo with yarn workspaces.

**Apps:**

- `apps/dm` — NestJS game server (Dungeon Master). REST + GraphQL API. Port 3000.
- `apps/slack` — Slack bot (ts-node-dev). Integrates with dm via GraphQL. Port 3002.
- `apps/tick` — Game tick service (cron-like, runs game loops).
- `apps/web` — Next.js frontend. Port 4000.
- `apps/slack-manifest` — CLI tool to push Slack manifest to dev/prod.

**Shared libs (`libs/`):**

- `database` — Prisma client and schema
- `api-contracts` — Shared GraphQL/REST types
- `redis-client` — Redis wrapper
- `constants`, `inventory`, `character-sheet`, `event-bus`, `logging`, `tracer`

**Infrastructure:** PostgreSQL + Redis via docker-compose. Nginx reverse proxy for prod.

## Conventions & Patterns

- TypeScript everywhere. NestJS patterns in `apps/dm` and `apps/tick`.
- Conventional commits (enforced by commitlint + husky).
- Tests use jest with `--runInBand`. Prisma and Redis are mocked — no live services needed.
- Turbo caches build outputs; run `yarn build` before `yarn test` in a fresh environment.
- Prisma schema lives in `libs/database/prisma/schema.prisma`. After schema changes: `yarn generate`.
- Env vars: each app has `.env` (committed defaults) + `.env.local` (gitignored overrides).

## Worktree Notes

When Claude Code opens this repo in a new worktree:

- Run `yarn build` before `yarn test` — tests depend on compiled lib outputs in `dist/`.
- Run `bd dolt pull` at session start to sync the latest issues from the remote Dolt branch.
- The docker-compose stack (PG, Redis, nginx) runs externally and is shared — do NOT run `docker-compose up` from a worktree.
- Port overrides if local services are needed: set `PORT`, `REDIS_URL`, `DATABASE_URL` env vars.
