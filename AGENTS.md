- Delete unused or obsolete files when your changes make them irrelevant (refactors, feature removals, etc.), and revert files only when the change is yours or explicitly requested. If a git operation leaves you unsure about other agents' in-flight work, stop and coordinate instead of deleting.
- **Before attempting to delete a file to resolve a local type/lint failure, stop and ask the user.** Other agents are often editing adjacent files; deleting their work to silence an error is never acceptable without explicit approval.
- NEVER edit `.env` or any environment variable files—only the user may change them.
- Coordinate with other agents before removing their in-progress edits—don't revert or delete work you didn't author unless everyone agrees.
- Moving/renaming and restoring files is allowed.
- ABSOLUTELY NEVER run destructive git operations (e.g., `git reset --hard`, `rm`, `git checkout`/`git restore` to an older commit) unless the user gives an explicit, written instruction in this conversation. Treat these commands as catastrophic; if you are even slightly unsure, stop and ask before touching them. _(When working within Cursor or Codex Web, these git limitations do not apply; use the tooling's capabilities as needed.)_
- Never use `git restore` (or similar commands) to revert files you didn't author—coordinate with other agents instead so their in-progress work stays intact.
- Always double-check git status before any commit
- Keep commits atomic: commit only the files you touched and list each path explicitly. For tracked files run `git commit -m "<scoped message>" -- path/to/file1 path/to/file2`. For brand-new files, use the one-liner `git restore --staged :/ && git add "path/to/file1" "path/to/file2" && git commit -m "<scoped message>" -- path/to/file1 path/to/file2`.
- Quote any git paths containing brackets or parentheses (e.g., `src/app/[candidate]/**`) when staging or committing so the shell does not treat them as globs or subshells.
- When running `git rebase`, avoid opening editors—export `GIT_EDITOR=:` and `GIT_SEQUENCE_EDITOR=:` (or pass `--no-edit`) so the default messages are used automatically.
- Never amend commits unless you have explicit written approval in the task thread.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for every commit message (e.g., `feat(slack): add changelog blocks`).
- Terminal has an authenticed session so gcloud cli is available.
- Never use gcloud cli to make modifications. Treat it as read only and use it for gathering information or debugging.

- Slack bot communication note:
  - All player-facing Slack communications are delivered via direct message (DM) with the bot. Commands that affect nearby players (for example, `pickup`) DM the acting player with detailed results and DM other players at the same x/y with a short, vague notification.

## Home Tab Rule

- Never regress this simplicity. The Home tab is a funnel, not a control panel.
- Different states should show different UIs:
  - No character -> Start Playing
  - Has character -> Resume Adventure
  - Power user -> secondary sections appear
- As you add paid plans, leaderboards, events, or advanced commands, do not put them back on the first-run Home tab.

## Coding Standards

- **Database Access**: Always use the `@mud/database` library for database interactions. Do NOT use `prisma` directly in application code.
- **Database Migrations**: Do NOT create migration SQL files manually. Modify `libs/database/prisma/schema.prisma` and run `yarn prisma migrate dev` (or similar tools) to generate migrations.

## Debugging and Logs

- **Unified log files**: When running services locally (`yarn serve`), all logs are written to `logs/` at the workspace root:
  - `logs/mud-combined.log` - Unified log file with all service interactions (DM, Slack, World, Tick, Engine)
  - `logs/mud-{service}-error.log` - Service-specific error logs (e.g., `mud-dm-error.log`, `mud-slack-error.log`)
- Logs are cleared on startup for fresh session tracking, making them ideal for AI agent analysis

### Common Issues

- **Event bus routing**: DM publishes notifications with type='combat' to channel `notifications:slack`. Slack bot subscribes to this channel and processes all notification types.

## Infrastructure

- **Production deployment**: GKE cluster on Google Cloud Platform (see `infra/terraform/` and `docs/DEPLOYMENT.md`)
- **Cluster name**: `mud-${environment}` (e.g., `mud-prod`)
- **Region**: Configured via Terraform variables (typically `us-central1`)
- **Services**: dm, world, slack, tick (all deployed as Kubernetes deployments)
- **Supporting resources**: Cloud SQL (PostgreSQL), Memorystore (Redis), Artifact Registry, Secret Manager
- **Debugging production**: Use `kubectl` to access pods and logs (requires gcloud authentication and cluster credentials)

## Active Technologies

- Node.js 20 / TypeScript 5 (NestJS services) + NestJS, Slack Bolt SDK, Prisma ORM, `@mud/event-bus`, `@mud/logging`, Datadog tracing (001-hq-market-crier)
- PostgreSQL (Cloud SQL) for player/inventory data; Redis EventBridge for pub/sub (001-hq-market-crier)

## Recent Changes

- 001-hq-market-crier: Added Node.js 20 / TypeScript 5 (NestJS services) + NestJS, Slack Bolt SDK, Prisma ORM, `@mud/event-bus`, `@mud/logging`, Datadog tracing
