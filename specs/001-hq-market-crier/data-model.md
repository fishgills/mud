# Data Model – Guild Hall Market & Crier

## GuildHall

| Field                       | Type         | Description                                        | Notes                                  |
| --------------------------- | ------------ | -------------------------------------------------- | -------------------------------------- |
| `id`                        | UUID         | Unique identifier for the guild hub (maps to tile) | Existing tile ID reused                |
| `tile_coordinates`          | JSON (x,y,z) | World position for teleport targeting              | Read-only reference                    |
| `population_limit`          | int          | Soft cap for simultaneous occupants                | Default 50; block when reached         |
| `services`                  | JSON         | Flags for shop, crier, exits currently available   | Used when announcing features          |
| `teleport_cooldown_seconds` | int          | Minimum interval before teleport can repeat        | Applied per player                     |
| `arrival_message`           | text         | Copy template returned to players                  | Includes instructions for `buy`/`sell` |

**Validation/Notes**: The Guild Hall record is seeded once via migration. Teleport cooldown defaults to 300s but may be overridden via config.

## PlayerGuildState

| Field                 | Type        | Description                                         | Notes                                 |
| --------------------- | ----------- | --------------------------------------------------- | ------------------------------------- |
| `player_id`           | UUID        | References `players.id`                             | PK & FK                               |
| `last_teleport_at`    | timestamptz | Timestamp of most recent successful `guild` command | Determines cooldown                   |
| `cooldown_expires_at` | timestamptz | Precomputed convenience column                      | Derived from last teleport + cooldown |
| `is_in_combat`        | bool        | Mirror of DM combat flag when teleport requested    | Used for rejection messaging          |
| `last_guild_location` | UUID        | Last known tile/room inside guild                   | Helps spawn near crier/shop           |

**Validation/Notes**: Maintained exclusively by DM service before/after teleportation. `is_in_combat` is read from DM runtime—not persisted permanently.

## ShopCatalogItem

| Field                      | Type   | Description                             | Notes               |
| -------------------------- | ------ | --------------------------------------- | ------------------- |
| `id`                       | UUID   | Item identifier                         |                     |
| `name`                     | text   | Display name shown in Slack menus       | Unique constraint   |
| `description`              | text   | Flavor text                             | Markdown-safe       |
| `buy_price_gold`           | int    | Cost to purchase                        | >=0                 |
| `sell_price_gold`          | int    | Gold returned when selling              | <= buy price        |
| `stock_quantity`           | int    | Current available stock                 | Cannot drop below 0 |
| `max_stock`                | int    | Capacity for restock                    | Used by scheduler   |
| `restock_interval_minutes` | int    | Duration to replenish 1 unit (optional) | Allows automation   |
| `tags`                     | text[] | Eligibility metadata (class, level)     | Filtered per player |
| `is_active`                | bool   | Hide / show item                        | Soft delete         |

**Relationships**: No direct FK to GuildHall (global catalog). Inventory service references these IDs when fulfilling orders.

## PlayerInventorySnapshot

| Field               | Type | Description                            | Notes                           |
| ------------------- | ---- | -------------------------------------- | ------------------------------- |
| `player_id`         | UUID | References players table               | PK                              |
| `item_id`           | UUID | References catalog or loot tables      | Composite key                   |
| `quantity`          | int  | Number of copies carried               | >=0                             |
| `encumbrance_score` | int  | Derived weight used for teleport rules | Keep under configured threshold |

**Validation/Notes**: DM service already persists inventory; this snapshot view is consumed by shop module before buy/sell. Add computed column or view if needed.

## TransactionReceipt

| Field                  | Type               | Description                                 | Notes                         |
| ---------------------- | ------------------ | ------------------------------------------- | ----------------------------- |
| `id`                   | UUID               | Receipt ID also used for Slack confirmation |                               |
| `player_id`            | UUID               | Actor performing trade                      | FK                            |
| `item_id`              | UUID               | Catalog item traded                         |                               |
| `direction`            | enum(`BUY`,`SELL`) | Indicates type                              |                               |
| `gold_delta`           | int                | Positive for SELL, negative for BUY         | Must balance with player gold |
| `quantity`             | int                | Number of items exchanged                   | >0                            |
| `created_at`           | timestamptz        | Timestamp recorded in DM logs               |                               |
| `event_bus_message_id` | UUID               | Links to emitted notification               | Optional                      |

**Notes**: Receipts are persisted for audits and referenced when reconciling SC-004 metric.

## AnnouncementRecord

| Field               | Type                                  | Description                         | Notes                   |
| ------------------- | ------------------------------------- | ----------------------------------- | ----------------------- |
| `id`                | UUID                                  | Unique message identifier           |                         |
| `title`             | text                                  | Headline shown in Slack             |                         |
| `body`              | text                                  | Full narrative for guild occupants  | Markdown-supported      |
| `digest`            | text                                  | Short summary for non-guild players | Required                |
| `priority`          | int                                   | Higher number surfaces first        | Default 0               |
| `visible_from`      | timestamptz                           | Earliest broadcast time             | Schedules announcements |
| `visible_until`     | timestamptz                           | Optional expiry                     | Skips stale news        |
| `last_announced_at` | timestamptz                           | Updated when NPC broadcasts         | Prevent duplicates      |
| `status`            | enum(`PENDING`,`ANNOUNCED`,`EXPIRED`) | Workflow state                      |                         |

**Relationships**: None beyond scheduling job; DM job queries this table ordered by priority+time.

## Relationships & State Transitions

- `PlayerGuildState` ↔ `TransactionReceipt`: teleports update cooldown columns; completed trades append receipts referencing players and items.
- `ShopCatalogItem.stock_quantity` decreases when receipts with `direction=BUY` are written and increases for SELL (bounded by `max_stock`).
- `AnnouncementRecord.status` flows PENDING → ANNOUNCED → EXPIRED. Town crier job sets `last_announced_at` and status; expired rows ignored.
- EventBus payloads link to `TransactionReceipt.id` and `AnnouncementRecord.id` for traceability.

## Validation Rules Summary

1. Teleportation allowed only when `cooldown_expires_at <= now()` and `is_in_combat = false`.
2. Purchases require `player.gold_balance >= buy_price_gold * quantity` and `stock_quantity >= quantity`.
3. Sales require `PlayerInventorySnapshot.quantity >= quantity` and catalog item `is_active = true`.
4. Town crier polls announcements where `status = 'PENDING'`, `visible_from <= now()`, and `visible_until` not passed.
