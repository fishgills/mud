# Tasks: Equipment System — Armor Slots and Weapon for Player Characters

**Input**: Design documents from `/specs/001-for-player-characters/`
**Prerequisites**: plan.md (required), spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Ensure feature branch and paths set (.specify/scripts/bash/check-prerequisites.sh --paths-only)
- [ ] T002 [P] Add DM module scaffold: apps/dm/src/modules/equipment/ (controller, service, dto, **tests**/)
- [ ] T003 [P] Add Slack commands scaffold: apps/slack-bot/src/commands/{equip.ts,unequip.ts,gear.ts}
- [ ] T004 [P] Add DM client in Slack adapter: apps/slack-bot/src/services/dm-client.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T005 Define contracts: specs/001-for-player-characters/contracts/equipment.openapi.yml (kept up-to-date)
- [ ] T006 Wire DM routes in app module: apps/dm/src/app.module.ts registers EquipmentModule
- [ ] T007 Define DTOs: apps/dm/src/modules/equipment/dto/{equip.dto.ts, unequip.dto.ts}
- [ ] T008 Implement validation helpers: apps/dm/src/modules/equipment/validation.ts
- [ ] T009 Add env validation placeholders if needed (no new vars expected)

---

## Phase 3: User Story 1 - Equip core gear (Priority: P1)

**Goal**: Players equip helmet, torso, legs, weapon; defense updates.
**Independent Test**: Equipping armor increases Total Defense; used in combat damage reduction.

### Implementation

- [ ] T010 [P] [US1] Service: apps/dm/src/modules/equipment/equipment.service.ts — slot checks, swap, totals
- [ ] T011 [US1] Controller: apps/dm/src/modules/equipment/equipment.controller.ts — POST /equipment/equip, /equipment/unequip, GET /equipment
- [ ] T012 [P] [US1] Integrate with persistence layer (Prisma service usage) in equipment.service.ts
- [ ] T013 [US1] Slack: apps/slack-bot/src/commands/equip.ts — parse `/equip <slot> <item>` and call DM
- [ ] T014 [US1] Slack: apps/slack-bot/src/commands/unequip.ts — parse `/unequip <slot>` and call DM

### Tests (optional per repo defaults)

- [ ] T015 [P] [US1] Unit tests: apps/dm/src/modules/equipment/**tests**/equipment.service.spec.ts
- [ ] T016 [US1] Integration tests: apps/dm/src/modules/equipment/**tests**/equipment.controller.spec.ts
- [ ] T017 [P] [US1] Slack handler tests: apps/slack-bot/src/commands/**tests**/equip.spec.ts

---

## Phase 4: User Story 2 - View equipment and stats impact (Priority: P2)

**Goal**: View equipped items by slot and Total Defense breakdown.
**Independent Test**: `/gear` shows each slot and accurate totals.

### Implementation

- [ ] T018 [US2] Controller: ensure GET /equipment includes per-slot items and totals
- [ ] T019 [P] [US2] Slack: apps/slack-bot/src/commands/gear.ts — render equipment view

### Tests

- [ ] T020 [US2] Controller test for EquipmentView shape
- [ ] T021 [P] [US2] Slack handler test for `/gear` formatting

---

## Phase 5: User Story 3 - Unequip and swap (Priority: P3)

**Goal**: Unequip items or swap directly; inventory updated accordingly.
**Independent Test**: Unequipping reduces Total Defense by item’s armor; swapping applies delta.

### Implementation

- [ ] T022 [US3] Service: implement unequip path and swap logic confirmations
- [ ] T023 [US3] Slack: ensure `/unequip` and equip replacement flows return prior item to inventory

### Tests

- [ ] T024 [US3] Service tests for unequip and swap edge cases

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T025 [P] Docs: Update apps/dm README and apps/slack-bot README with endpoints/commands
- [ ] T026 [P] Add error messages for invalid slot/item and ensure user-friendly Slack responses
- [ ] T027 [P] Verify performance p95 < 200ms for equip/view endpoints

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US1 (MVP) → US2 → US3 → Polish
- Parallel opportunities: T002/T003/T004; T010/T012; Slack tests can run parallel to DM tests
