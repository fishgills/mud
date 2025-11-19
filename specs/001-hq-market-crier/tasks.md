---
description: 'Task list template for feature implementation'
---

# Tasks: Guild Hall Market & Crier

**Input**: Design documents from `/specs/001-hq-market-crier/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are mandatory per constitution for teleport cooldowns, shop trades, and crier scheduling; each user story lists required suites.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- **Constitution hooks**: Every story needs explicit tasks for (a) Slack command/DM UX, (b) DM service changes + migrations, (c) EventBus emissions/consumers, (d) automated tests (unit/integration/contracts), and (e) logging/metrics work.

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Ensure local services run via `yarn serve` and update guild seed script path references in `apps/dm/scripts/seed-guild.js`
- [x] T002 Document Slack bot invite + environment notes in `specs/001-hq-market-crier/quickstart.md` (confirm accuracy)

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 Create Prisma migration for guild tables (`GuildHall`, `ShopCatalogItem`, `AnnouncementRecord`, `TransactionReceipt`) in `libs/database/prisma/schema.prisma`
- [x] T004 Update DM configuration to load guild hall metadata and cooldown defaults in `apps/dm/src/config/guild.config.ts`
- [x] T005 Add shared DTOs for teleport/buy/sell/announcements in `libs/api-contracts/src/guild.ts`
- [x] T006 Add EventBus payload definitions + enums for guild events in `libs/event-bus/src/events/guild.ts`
- [x] T007 Add logging/tracing helpers (correlation fields) in `libs/logging/src/guild.ts`
- [x] T008 Seed default catalog + announcements data via `apps/dm/scripts/seed-guild.ts`
- [x] T009 Update quickstart to reflect new seed command (already partially done)

## Phase 3: User Story 1 – Teleport to Guild Hall (Priority: P1) 🎯 MVP

**Goal**: Players can teleport to the guild using `guild`, receiving arrival info and notifier updates.
**Independent Test**: Trigger `guild` command from multiple locations; verify DM denies combat/cooldown cases and notifies occupants.

### Tests

- [x] T010 [US1] Extend `apps/dm/test-dm.sh` with `guild-teleport` scenario covering cooldown/combat blocks
- [x] T011 [P] [US1] Add Jest unit tests for teleport service (`apps/dm/src/modules/teleport/teleport.service.spec.ts`)
- [x] T012 [P] [US1] Add contract tests for `/guild/teleport` in `libs/api-contracts/tests/guild.teleport.spec.ts`

### Implementation

- [x] T013 [US1] Implement teleport eligibility checks + cooldown writes in `apps/dm/src/modules/teleport/teleport.service.ts`
- [x] T014 [US1] Add Prisma repository for `PlayerGuildState` in `apps/dm/src/modules/teleport/teleport.repository.ts`
- [x] T015 [P] [US1] Implement `/guild/teleport` controller + DTO validation in `apps/dm/src/modules/teleport/teleport.controller.ts`
- [x] T016 [US1] Update EventBus publisher to emit `guild.teleport.arrived` and occupant notifications in `apps/dm/src/modules/teleport/teleport.publisher.ts`
- [x] T017 [US1] Implement Slack command handler `apps/slack/src/handlers/guild.ts` with acknowledgement + DM copy
- [x] T018 [US1] Log teleport attempts (success/failure) with correlation IDs in `apps/dm/src/modules/teleport/teleport.service.ts`
- [x] T019 [US1] Add monitoring metrics (Datadog span `guild.command`) in `apps/dm/src/modules/teleport/teleport.metrics.ts`
- [x] T020 [US1] Update quickstart with teleport troubleshooting section `specs/001-hq-market-crier/quickstart.md`

## Phase 4: User Story 2 – Trade Items at Guild Market (Priority: P2)

**Goal**: Players can `buy`/`sell` items while in guild; DM handles gold/inventory transactions.
**Independent Test**: Use Slack `buy` and `sell` commands; verify receipts, EventBus notifications, and DB consistency.

### Tests

- [ ] T021 [US2] Add Jest unit tests for shop service transaction flows in `apps/dm/src/modules/shop/shop.service.spec.ts`
- [ ] T022 [P] [US2] Add integration tests for buy/sell via `apps/dm/test-dm.sh guild-shop`
- [ ] T023 [P] [US2] Add contract tests for `/guild/shop/buy` and `/guild/shop/sell` in `libs/api-contracts/tests/guild.shop.spec.ts`

### Implementation

- [ ] T024 [US2] Implement shop service with Prisma transactions (catalog locking, gold checks) in `apps/dm/src/modules/shop/shop.service.ts`
- [ ] T025 [US2] Implement `/guild/shop/buy` controller + DTOs in `apps/dm/src/modules/shop/shop.controller.ts`
- [ ] T026 [US2] Implement `/guild/shop/sell` handler in same controller with validation reuse
- [ ] T027 [US2] Add EventBus publisher for receipt events `apps/dm/src/modules/shop/shop.publisher.ts`
- [ ] T028 [US2] Update Slack command handlers `apps/slack/src/commands/buy.ts` and `.../sell.ts`
- [ ] T029 [US2] Generate Slack receipt templates (player + co-located summary) in `apps/slack/src/views/guild-shop.ts`
- [ ] T030 [US2] Add logging for trade outcomes with correlation IDs `apps/dm/src/modules/shop/shop.logger.ts`
- [ ] T031 [US2] Update quickstart with buy/sell testing instructions in `specs/001-hq-market-crier/quickstart.md`

## Phase 5: User Story 3 – Hear Town Crier Announcements (Priority: P3)

**Goal**: Automated NPC polls DB, broadcasts to guild occupants, sends digests to others.
**Independent Test**: Seed announcements, run scheduler, confirm Slack outputs + deduping.

### Tests

- [ ] T032 [US3] Add Jest tests for announcement scheduler logic in `apps/dm/src/modules/announcements/announcements.scheduler.spec.ts`
- [ ] T033 [P] [US3] Add integration tests for cron-driven broadcasts in `apps/dm/test-dm.sh guild-crier`
- [ ] T034 [P] [US3] Add contract tests for `/guild/announcements/next` in `libs/api-contracts/tests/guild.announcements.spec.ts`

### Implementation

- [ ] T035 [US3] Implement announcement scheduler job reading `AnnouncementRecord` in `apps/dm/src/modules/announcements/announcements.scheduler.ts`
- [ ] T036 [US3] Implement `/guild/announcements/next` endpoint to support manual/cron polling `apps/dm/src/modules/announcements/announcements.controller.ts`
- [ ] T037 [US3] Implement EventBus publisher + Slack digest formatting `apps/dm/src/modules/announcements/announcements.publisher.ts`
- [ ] T038 [US3] Implement Slack listener for broadcast/digest messages `apps/slack/src/services/guild-crier.service.ts`
- [ ] T039 [US3] Add logging + metrics for crier job outcomes `apps/dm/src/modules/announcements/announcements.logger.ts`
- [ ] T040 [US3] Update quickstart with crier testing steps `specs/001-hq-market-crier/quickstart.md`

## Phase 6: Polish & Cross-Cutting

- [ ] T041 Review and update documentation (`spec.md`, `plan.md`) with implementation notes
- [ ] T042 Add dashboards/alerts for guild telemetry in monitoring config (docs/observability.md)
- [ ] T043 Run full test/lint suite and ensure logs are clean before release
- [ ] T044 Prepare release checklist entry (Guild Hall Market & Crier) in `report/RELEASE_NOTES.md`

## Dependencies & Execution Order

1. Complete Phases 1-2 before any story work.
2. US1 (Teleport) must ship before US2/US3 since shop+crier require guild access.
3. US2 (Shop) and US3 (Crier) can proceed in parallel once teleport is stable, except shared modules (EventBus/logging) should be coordinated.

## Parallel Execution Examples

- US1: Jest unit tests (T011) can run parallel to controller implementation (T015) once DTOs defined.
- US2: Slack handler updates (T028) can run parallel to DM service work (T024) after contract mocks ready.
- US3: Slack digest formatter (T038) can be built while scheduler logic (T035) is underway, sharing contract payloads.

## Implementation Strategy

1. Ship US1 as MVP – enables teleport and sets baseline logging/tests.
2. Layer US2 for commerce once teleport is proven; ensure receipts/tracing solid.
3. Add US3 announcements afterwards; finalize telemetry + polish.
