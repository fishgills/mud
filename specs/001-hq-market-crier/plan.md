# Implementation Plan: [FEATURE]

**Branch**: `001-hq-market-crier` | **Date**: 2025-11-17 | **Spec**: [spec](./spec.md)
**Input**: Feature specification from `/specs/001-hq-market-crier/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Teleporting players directly to the Guild Hall unlocks in-Slack buy/sell commerce and automated town crier announcements so players can convene quickly and stay informed without trekking across the map.

## Technical Context

**Language/Version**: Node.js 20 / TypeScript 5 (NestJS services)  
**Primary Dependencies**: NestJS, Slack Bolt SDK, Prisma ORM, `@mud/event-bus`, `@mud/logging`, Datadog tracing  
**Storage**: PostgreSQL (Cloud SQL) for player/inventory data; Redis EventBridge for pub/sub  
**Testing**: Jest unit/integration suites plus `apps/dm/test-dm.sh` scenario harness and contract tests in `libs/api-contracts`  
**Target Platform**: Slack-based clients backed by GKE-hosted NestJS services  
**Project Type**: Turborepo monorepo with multiple apps (`apps/slack`, `apps/dm`, `apps/world`, `apps/tick`)  
**Performance Goals**: `guild` replies under 2s; shop transactions under 2s; crier broadcasts within 5s of DB update  
**Constraints**: DM service is sole writer; Slack rate limits; no new secret storage (use GCP Secret Manager); reuse existing tile metadata and inventory schema  
**Scale/Scope**: ~50 concurrent players per Guild instance, <100 shop items, announcement backlog <20 messages

## Constitution Check

1. **Slack-First Player Experience** – Spec 'User Story 1-3' define `guild`, `buy`, `sell`, and crier outputs with timing/fallbacks (combat blocks, stock errors). Plan ensures Slack copy stays updated.
2. **DM-Orchestrated Simulation** – Teleportation, commerce, and announcements all route through DM modules per FR-001–FR-006; Slack never mutates DB.
3. **Event-Driven Visibility** – Commerce receipts + crier jobs emit EventBus events (`notifications:slack`, `world:announcements`) with correlation IDs, satisfying FR-004/5/6/7.
4. **Test-Gated Iteration** – New Jest + `apps/dm/test-dm.sh` suites will fail first for teleport cooldowns, trade math, and crier scheduling before implementation, matching SC-001–SC-004.
5. **Operability & Incident Readiness** – FR-007 adds structured logs/metrics (command start/end, gold delta, crier pulls) and uses existing logging/tracing stack without `.env` edits.

## Project Structure

### Documentation (this feature)

```text
repo/
├── apps/dm/                # Teleportation, commerce orchestration, town crier scheduler
│   ├── src/modules/teleport
│   ├── src/modules/shop
│   └── src/modules/announcements
├── apps/slack/             # Slack command handlers for `guild`, `buy`, `sell`
│   └── src/interactive/
├── libs/api-contracts/     # DTOs for teleport/shop actions + announcement payloads
├── libs/event-bus/
├── libs/logging/
└── specs/001-hq-market-crier/
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md
    └── contracts/
```

**Structure Decision**: Continue using existing multi-app Turborepo: DM owns world state changes, Slack app issues commands, shared libs provide contracts/logging.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Phase 0 – Research & Unknown Resolution

### Objectives

- Validate Slack interaction patterns, teleport gating rules, shop transaction integrity, town crier automation, and observability/test approach.
- Capture findings in `specs/001-hq-market-crier/research.md` following the Decision/Rationale/Alternatives format.

### Tasks

1. Document Slack UX best practices for multi-step commands (`guild`, `buy`, `sell`) and DM acknowledgements.
2. Research teleport eligibility + cooldown enforcement to discourage combat abuse.
3. Define shop pricing + inventory transaction strategy using Prisma/DM modules.
4. Establish automated town crier polling cadence and deduplication strategy.
5. Outline observability + test harness coverage (Jest + `apps/dm/test-dm.sh` + contract tests).

### Outputs

- Completed research artifact resolving all outstanding questions (✅ `research.md`).
- Updated Summary/Technical Context sections with concrete data from research.

## Phase 1 – Design & Contracts

### Prerequisites

- Phase 0 research finalized and reviewed.
- Constitution check still passes with new details (revalidated in section below).

### Deliverables

1. **Data Model (`data-model.md`)** – Entities for Guild Hall, Player Session, Shop Catalog, Transaction Receipt, Announcement Payload with validation rules + relationships.
2. **API Contracts (`contracts/guild-openapi.yaml`)** – OpenAPI snippet describing DM endpoints for teleport, buy, sell, and announcement polling hooks including schemas + error payloads.
3. **Quickstart (`quickstart.md`)** – Step-by-step instructions to run DM + Slack services locally, seed shop/announcement data, invoke commands, and execute Jest + integration suites.
4. **Agent Context Update** – Run `.specify/scripts/bash/update-agent-context.sh codex` to register new technology/process notes for future agents.

### Design Tasks

- Map specification FRs to modules inside `apps/dm` (teleport, shop, announcements) and `apps/slack` handlers.
- Define DB schema diffs (new tables/columns) and migrations for catalog + announcements.
- Specify EventBus event payloads and logging fields for telemetry.

## Constitution Check (Post-Design)

All five principles remain satisfied after Phase 1 assets:

1. Slack-first: `guild`/`buy`/`sell` UX + crier auto-DMs documented in quickstart and contracts.
2. DM authority: Data model + contracts keep all mutations inside DM service APIs/migrations.
3. Event visibility: Contracts specify EventBus messages with correlation IDs for receipts and announcements.
4. Test-first: Quickstart + design call out Jest + integration coverage to be written before code.
5. Operability: Logging fields + metrics defined in design docs; no new secrets introduced.
