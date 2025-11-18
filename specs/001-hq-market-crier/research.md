# Research: Guild Hall Market & Crier

## Slack Command UX for `guild` / `buy` / `sell`

- **Decision**: Use Slack slash commands (or bot keyword detection) that immediately acknowledge with an ephemeral "traveling" or "processing" notice, then send a rich DM once the DM service confirms teleport/trade.
- **Rationale**: Matches Slack's 3-second response requirement, keeps players informed when DM processing or combat checks delay results, and maintains parity with existing commands like `new`, `north`, `attack`.
- **Alternatives considered**: (a) Long-running slash command responses (risks timeouts and dropped feedback); (b) Channel-only responses (noisy for co-located players and violates Slack-first guidance on actionable DMs).

## Teleport Eligibility & Cooldowns

- **Decision**: Enforce a cooldown + combat lock by querying DM state before teleport; deny requests with actionable text if the player is in combat, encumbered, or on cooldown, and log an audit event.
- **Rationale**: Prevents exploitation (combat escape, infinite hop) and aligns with spec FR-003 plus constitution DM-authority requirement.
- **Alternatives considered**: (a) Allow teleport anytime (breaks combat balance); (b) Rely solely on tick worker to detect abuse (adds latency, allows double spend).

## Shop Pricing & Inventory Consistency

- **Decision**: Manage buy/sell via Prisma transactions scoped to DM service: lock catalog rows, verify player gold/inventory, mutate, and emit EventBus receipt.
- **Rationale**: Ensures DM remains single writer, avoids race conditions on simultaneous buy/sell (matches Edge Case guidance), and produces deterministic logs for audit.
- **Alternatives considered**: (a) Handling trades in Slack app (breaks DM authority); (b) Non-transactional updates (risk of duplicate items/gold drift).

## Town Crier Automation

- **Decision**: Run a DM-hosted scheduled job (cron or tick hook) that polls the announcements table every minute, emits new messages via EventBus once, and records last-announced timestamps to prevent repeats.
- **Rationale**: Keeps the crier NPC autonomous without admin UI, honors FR-006 requirements, and leverages existing DM scheduler infrastructure.
- **Alternatives considered**: (a) Manual Slack command by admins (not available yet, per user constraint); (b) Real-time DB triggers (harder to observe/trace, less portable).

## Observability & Testing Focus

- **Decision**: Extend `@mud/logging` contexts for teleport, buy, sell, and crier jobs with correlation IDs; add Jest + `apps/dm/test-dm.sh` suites covering cooldown enforcement, transactional trades, and announcement cadence.
- **Rationale**: Satisfies FR-007 and constitution's test-gated iteration principle—failures surface before manual Slack validation, and logs aid on-call triage.
- **Alternatives considered**: (a) Manual QA only (slow, violates constitution); (b) Logging only at Slack layer (misses DM internals, harder to trace).
