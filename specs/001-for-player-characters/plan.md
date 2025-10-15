# Implementation Plan: Equipment System — Armor Slots and Weapon for Player Characters

**Branch**: `001-for-player-characters` | **Date**: 2025-10-15 | **Spec**: ../spec.md
**Input**: Feature specification from `/specs/001-for-player-characters/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add equipment to player characters with slots helmet, torso, legs, and weapon. Slack Bolt app parses user commands to equip/unequip/view; DM (NestJS) owns validation, state changes, and defense calculation. Armor contributes to Total Defense used in damage mitigation; weapon does not affect defense.

## Technical Context

**Language/Version**: TypeScript (strict) 5.9+  
**Primary Dependencies**: NestJS (@mud/dm), Slack Bolt (@mud/slack-bot), Prisma/PostgreSQL, Redis, Jest (@swc/jest)  
**Storage**: PostgreSQL (via Prisma in libs/database); cache via Redis (libs/redis-client)  
**Testing**: Jest with SWC; DI/mocks for Prisma/Redis/HTTP; env validated with envalid  
**Target Platform**: GCP Cloud Run services (DM, Slack adapter)  
**Project Type**: Monorepo with multiple apps (dm, slack-bot) and shared libs  
**Performance Goals**: Sub-200ms p95 for equip/view endpoints (no AI paths)  
**Constraints**: Service boundaries enforced (no cross-service DB), client-agnostic IDs  
**Scale/Scope**: Supports all active Slack users; O(1) equip operations; persistence across sessions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Verify compliance with Mud Constitution (`.specify/memory/constitution.md`):

- [x] **Modularity**: Logic isolated in DM; Slack adapter only parses/prints
- [x] **Service Boundaries**: All game rules in `@mud/dm`; Slack is I/O only
- [x] **Test-First**: Add unit + integration tests with 80%+ coverage
- [x] **Type Safety**: Strict TS, DTOs, envalid per app
- [x] **Client-Agnostic**: Use `clientId` and playerId mapping; no Slack-specific fields in core
- [x] **Performance**: Cache reads where appropriate; simple equip paths sub-200ms p95
- [x] **Dependencies**: Reuse existing libs; justify any new packages in app package.json

**Complexity Violations**: None.

## Project Structure

### Documentation (this feature)

```
specs/001-for-player-characters/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

### Source Code (repository root)

```
apps/dm/
├── src/
│  ├── modules/equipment/
│  │  ├── equipment.controller.ts      # REST endpoints (equip/unequip/view)
│  │  ├── equipment.service.ts        # Rules: slot validation, swapping, totals
│  │  ├── dto/                         # Equip/Unequip DTOs
│  │  └── __tests__/                   # Unit + integration tests
│  └── ...
└── tests/ (if present per app config)

apps/slack-bot/
├── src/
│  ├── commands/equip.ts               # /equip, /unequip, /gear
│  ├── services/dm-client.ts           # Calls DM REST with auth
│  └── __tests__/
└── ...

libs/
├── database/                          # Prisma models (if new fields needed)
├── redis-client/
└── constants/
```

**Structure Decision**: Implement equipment as a DM module with REST contracts; Slack adapter maps commands to DM endpoints and renders messages. No core logic in Slack.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
