# Inventory & Ground Loot Plan (summary)

- Slots: head, chest, arms, legs, weapon
- Capacity formula: 10 + Strength
- Weapon: single-hand only
- Stacking: no
- Backfill: not required (legacy columns unused)
- Monster behavior: drops items to ground; player is notified generically and must pick up items explicitly; items persist on ground
- All items pickupable for now
- Quality tiers (15): Trash → Divine

High-level steps:

1. DB: add `PlayerItem`, `WorldItem`, `ItemQuality` enum
2. Server: add `PlayerItemService`, `LootService`, `LootGenerator`
3. Factories/adapters: load playerItems and map to `equipment` and `bag`
4. APIs: add pickup/equip/drop endpoints with Redis lock + DB transaction
5. Slack: add `PICKUP`/`DROP` handlers and update inventory renderer
6. Tests: loot generator, pickup concurrency, equip semantics, API tests

Next actions:

- Implement API endpoints and Redis locking for pickup
- Flesh out service logic and unit/integration tests
