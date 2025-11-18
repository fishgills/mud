<!--
Sync Impact Report
Version change: N/A → 1.0.0
Modified principles:
- Template Principle 1 → Slack-First Player Experience
- Template Principle 2 → DM-Orchestrated Simulation
- Template Principle 3 → Event-Driven Visibility
- Template Principle 4 → Test-Gated Iteration
- Template Principle 5 → Operability & Incident Readiness
Added sections:
- Service & Infrastructure Constraints
- Development Workflow & Quality Gates
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ⚠ .specify/templates/commands/*.md (directory missing; confirm whether command docs should exist)
Follow-up TODOs:
- None
-->

# Mud Constitution

## Core Principles

### I. Slack-First Player Experience

- All gameplay additions MUST expose a Slack DM or channel interaction (command, button, or workflow); features without a Slack surface cannot ship.
- Player commands MUST return actionable summaries within 2 seconds or send an immediate acknowledgement followed by a DM update, and all co-located players MUST receive abbreviated notifications.
- Responses MUST include authoritative state (position, stats, combat log, or next-step guidance) and declare outages when upstream services are offline instead of silently failing.
  Slack is the only player interface, so prioritizing Slack-ready flows keeps the world coherent and predictable for every adventurer.

### II. DM-Orchestrated Simulation

- The DM service and tick worker are the sole writers of world state; other services MUST call documented DM APIs instead of touching the database directly.
- Schema migrations MUST run through Prisma with reviewed scripts, and operational backfills MUST be committed DM utilities so the tick history stays reproducible.
- World rendering, Slack responses, and tooling MAY cache reads but MUST treat the DM API as the source of truth and invalidate caches when DM publishes mutations.
  Centralizing authority inside the DM preserves determinism and eliminates player-visible desyncs.

### III. Event-Driven Visibility

- Every material state change (combat, loot, movement, status effects) MUST emit an EventBus event that is bridged through `@mud/redis-client` to `notifications:slack` and any other subscribed channels.
- New event types MUST document payloads and consumer obligations, including Slack formatting fallbacks, before code merges.
- Event payloads MUST carry correlation IDs from `@mud/logging`/`@mud/tracer` so incidents can be reconstructed across services and pods.
  Shared events keep DM, Slack, World, and Tick aligned without brittle service-to-service calls.

### IV. Test-Gated Iteration

- Plans MUST list the unit, integration, and contract tests that will prove each story; implementation MUST start by writing or updating those tests so they fail before code changes.
- DM combat/encounter logic MUST be covered by `apps/dm/test-dm.sh` or Jest suites, and any new Slack command MUST have regression tests in the relevant app plus contract coverage in `libs/api-contracts`.
- Git merges MUST demonstrate `yarn test` (or targeted `yarn turbo run test --filter`) success plus scenario coverage for tick progression; manual Slack poking is never sufficient evidence.
  Tests guard against regressions in an AI-driven simulation where small bugs cascade quickly.

### V. Operability & Incident Readiness

- Services MUST use `@mud/logging` and `@mud/tracer` to emit structured JSON logs and traces; no ad-hoc console logging is permitted.
- Running `yarn serve` MUST produce actionable entries inside `logs/mud-combined.log` and service-specific error logs; new features MUST log intent, inputs, and outcomes so pages can be triaged.
- Production changes MUST include metrics or alerts for tick latency, event backlog, and Slack command failures, and secrets MUST always stay in GCP Secret Manager (never committed `.env` modifications).
  High-fidelity telemetry and disciplined secret handling make on-call response feasible for a multiplayer world.

## Service & Infrastructure Constraints

- Toolchain: Node.js 20+, Yarn 1.22+, NestJS services, Prisma ORM, PostgreSQL via Cloud SQL, Redis via Memorystore, plus Datadog tracing/log shipping.
- Monorepo boundaries are fixed: `apps/world`, `apps/dm`, `apps/slack`, `apps/tick`, and shared libs under `libs/`. Moving logic between them requires updating contracts and deployment manifests.
- Slack Bolt apps in `apps/slack` are the only ingress for players. Commands such as `new`, `north`, `attack`, and `map` MUST be preserved, and new ones MUST publish documentation alongside the DM change.
- Local development uses `yarn serve`; logs reside in `logs/` and MUST remain parseable for other agents. Environment variable files (e.g., `.env`) are developer-owned artefacts and MUST NOT be edited in this repo.
- Infrastructure deploys to GKE clusters `mud-${environment}`. Terraform under `infra/terraform` defines the contract; direct `kubectl` edits MUST be captured as Terraform or rollback instructions in docs.

## Development Workflow & Quality Gates

- Every feature requires a spec (`specs/[###-feature]/spec.md`) describing Slack stories, DM impacts, event emissions, and measurable outcomes before planning starts.
- Implementation plans MUST include a Constitution Check that explicitly answers how each principle is upheld; if any rule is intentionally broken, the plan MUST capture compensating controls and risks.
- Task lists MUST group work by user story and highlight where tests, migrations, or observability hooks land so teams can parallelize without stepping on Slack responses or DM ticks.
- Reviews MUST verify: Slack-first acceptance paths exist, DM remains authoritative, events are emitted/logged, and tests/telemetry landed. Violations block merges until fixed or an amendment passes.

## Governance

- This constitution supersedes conflicting docs. Contributors MUST pause work when they discover a violation and resolve it before merging or deploying.
- Amendments require: (1) a proposal summarizing the rationale and blast radius, (2) updates to this file plus all affected templates/checklists, and (3) evidence that downstream runtime docs (README, quickstarts) remain accurate.
- Versioning follows SemVer: MAJOR for removed/redefined principles, MINOR for new sections or materially expanded requirements, PATCH for clarifications. Every change MUST record SemVer impact in the Sync Impact Report comment.
- Compliance reviews occur at spec, plan, and PR stages. Each stage MUST reference the principles explicitly, and PRs MUST cite the relevant spec/plan section demonstrating adherence.
- Ratified/Amended dates capture when the project collectively accepted the governance; future amendments MUST update `Last Amended` and describe deltas in the Sync Impact Report.

**Version**: 1.0.0 | **Ratified**: 2025-11-18 | **Last Amended**: 2025-11-18
