# Research — Equipment System

## Decisions

- Decision: Core equipment logic lives in DM (NestJS); Slack Bolt only handles commands and formatting.
  - Rationale: Constitution requires client-agnostic core; enables future Discord/Web without changes.
  - Alternatives: Logic in Slack adapter — rejected (violates Service-Oriented Architecture principle).

- Decision: REST endpoints for equip/unequip/view under DM service.
  - Rationale: Repo standard is REST between services; aligns with existing auth and tooling.
  - Alternatives: Direct DB access from Slack — rejected (cross-service DB access prohibited).

- Decision: Total Defense = Base Defense + sum(armorValue of helmet, torso, legs); weapon contributes 0.
  - Rationale: Matches feature spec; predictable, testable mitigation.
  - Alternatives: Percentage reduction — rejected for initial scope; add later if needed.

- Decision: Item schema includes slotType and non-negative armorValue; negative rejected.
  - Rationale: Prevents degenerate states; keeps MVP simple.
  - Alternatives: Allow negatives as curses — deferred.

## Open Questions (Resolved)

- Testing approach: Jest with SWC; mock Prisma/Redis/HTTP. Status: resolved per repo standards.
- Persistence: Prisma via libs/database; migrations added if new fields needed. Status: resolved.
- Client IDs: Use client-agnostic IDs; Slack user mapped to playerId in DM. Status: resolved.
