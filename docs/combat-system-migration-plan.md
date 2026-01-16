# Plan

Migrate the DM combat engine to the formulas in `docs/combat-system.md`, replacing all D&D-style math and aligning combat logs/messaging with the new ratings-based system. Gear bonuses will contribute to base S/A/H inputs (not ratings), weapon dice will remain part of damage, crits will be enabled, and XP/gold formulas will stay as-is.

## Scope

- In: DM combat engine math, combatant/stat derivation, combat log/DTO fields, combat messaging, and related tests/docs.
- Out: XP/gold rebalancing, non-DM clients/UI redesigns, database schema changes unless strictly required.

## Action items

[ ] Audit current combat flow and data usage in `apps/dm/src/app/combat/engine.ts`, `apps/dm/src/app/combat/combat.service.ts`, `apps/dm/src/app/combat/messages.ts`, and `apps/dm/src/app/api/dto/responses.dto.ts`.
[ ] Define how gear bonuses map into base S/A/H inputs and specify the new per-round log fields for transparency.
[ ] Implement the new math in `apps/dm/src/app/combat/engine.ts` (effective stats, AR/DR, hit chance clamp, mitigation, HP scaling, initiative, crits).
[ ] Update combatant building and player stat snapshots in `apps/dm/src/app/combat/combat.service.ts` and `apps/dm/src/app/player/player-stats.util.ts` to compute max HP, hit chance inputs, and derived metrics needed by clients.
[ ] Update `apps/dm/src/app/api/dto/responses.dto.ts` and `apps/dm/src/app/combat/messages.ts` to reflect new round fields and remove D&D-specific terms.
[ ] Update tests in `apps/dm/src/app/combat/engine.spec.ts`, `apps/dm/src/app/combat/combat.service.spec.ts`, and `apps/dm/src/app/combat/messages.spec.ts` for new math, clamps, and crit behavior.
[ ] Validate with `yarn turbo run test --filter=@mud/dm`, then spot-check combat logs and Slack messages for clarity and expected bounds.
[ ] Update `apps/dm/README.md` to describe the new combat system once behavior is verified.

## Open questions

- None.
