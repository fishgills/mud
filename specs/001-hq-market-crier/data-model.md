# Data Model – Guild Hall Market & Crier

## Guild Hall (in-code)

There is a single guild hall destination defined in configuration (see `apps/dm/src/config/guild.config.ts`). No database table stores guild metadata; teleport behavior relies on player state (`isInHq`/`lastWorldX`,`lastWorldY`) and service-level cooldown checks.

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

**Relationships**: Catalog items are global; inventory service references these IDs when fulfilling orders.

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

- `ShopCatalogItem.stock_quantity` decreases when receipts with `direction=BUY` are written and increases for SELL (bounded by `max_stock`).
- `AnnouncementRecord.status` flows PENDING → ANNOUNCED → EXPIRED. Town crier job sets `last_announced_at` and status; expired rows ignored.
- EventBus payloads link to `TransactionReceipt.id` and `AnnouncementRecord.id` for traceability.

## Validation Rules Summary

1. Teleportation allowed only when service-level cooldown rules pass and player is not in combat (handled in DM logic).
2. Purchases require `player.gold_balance >= buy_price_gold * quantity` and `stock_quantity >= quantity`.
3. Sales require `PlayerInventorySnapshot.quantity >= quantity` and catalog item `is_active = true`.
4. Town crier polls announcements where `status = 'PENDING'`, `visible_from <= now()`, and `visible_until` not passed.
