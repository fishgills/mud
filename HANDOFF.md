## Plan: Teleport HQ Overhaul

Introduce a global HQ zone that replaces settlements, lets players store last-world positions, teleport in/out under existing spawn rules, interact with a basic vendor, and receive periodic announcements.

### Steps

1. Remove settlement schemas, services, and map layers in `apps/world/src`, `libs/database`, and `apps/slack/src`; generate a schema migration that drops settlement tables and deletes settlement map overlays plus any DM narrative content tied to them.
2. Extend player location persistence in `libs/database/src` to track `isInHQ`, `lastWorldPosition`, and a timestamp for the last HQ entry; ensure existing save/load paths and cache layers propagate the new fields.
3. Add HQ enter/exit handlers in `apps/world/src` that call the current spawn selector service for outbound teleport destinations, set `lastWorldPosition` when entering HQ, and restore it when leaving if the player chooses “return to last location.”
4. Update DM/Slack flows in `apps/dm/src` and `apps/slack/src` to handle a single DM-driven `teleport` command that moves the player to HQ when issued from the world and prompts for “return to last location” vs “random spawn” when issued inside HQ; include HQ population totals and vendor options in the follow-up message.
5. Implement HQ vendor NPC and timed town-crier broadcast in `apps/world/src`, using existing inventory transaction helpers for buy/sell and scheduling a broadcast job in `apps/tick/src` that emits an announcement every five minutes to players marked `isInHQ` via the event bus so DM and Slack services receive the same message payload.

### Further Considerations

1. Drop settlement tables without migration.
2. Use the HQ town crier announcement to introduce the new teleport commands on rollout.

## Progress

- 2025-11-12: Updated Prisma schema to remove settlements and add HQ tracking fields; created migration `20251112000000_remove_settlements_add_hq`.
- 2025-11-13: Purged settlement metadata from DM monster/prefetch flows and Slack look/sniff handlers; refreshed associated Jest suites (`apps/dm`: 219 tests, `apps/slack`: sniff + commandHandlers) to confirm settlement-free payloads.
