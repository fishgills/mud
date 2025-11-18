# Feature Specification: Guild Hall Market & Crier

**Feature Branch**: `001-hq-market-crier`  
**Created**: 2025-11-18  
**Status**: Draft  
**Input**: User description: "Our slack game has a concept of a Headquarters that players can teleport to. In the headquarters, there should be a shop type of interface that players can buy/sell items for gold. Also a town crier to make announcements to players (Or system announcements)."

## Constitution Alignment _(mandatory)_

- **Slack-First Player Experience** – Slack commands `guild`, `buy`, and `sell` described in User Stories 1-2 define the full player experience, response copy, and notification timing for co-located players; the town crier broadcasts automatically with no manual slash command.
- **DM-Orchestrated Simulation** – Functional Requirements FR-001–FR-006 keep the DM/tick flow authoritative for teleportation, inventory, and gold transactions; no other service may mutate state.
- **Event-Driven Visibility** – FR-004, FR-005, and FR-006 require EventBus emissions (`notifications:slack`, `world:announcements`) so Slack, world renderer, and tick worker share the same updates.
- **Test-Gated Iteration** – Success Criteria SC-001–SC-004 and the Independent Tests in each User Story outline the automated scenarios that must be scripted before implementation (unit for balance math, integration for Guild visit, contract tests for announcements).
- **Operability & Incident Readiness** – FR-007 mandates structured logging/metrics for teleportations, shop trades, and announcements so incidents can be traced without editing `.env` inputs.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Teleport to Guild Hall (Priority: P1)

Players need a reliable way to reach the shared Guild Hall from Slack so they can access vendors, announcements, and other social spaces without walking tile-by-tile.

**Why this priority**: Guild access is the gateway to the rest of the feature (shop and town crier) and removes friction for Slack-based play sessions.

**Independent Test**: Trigger the `guild` Slack command from multiple map coordinates and confirm the DM response moves the player to the Guild Hall tile, confirms arrival text (including instructions to use `buy`/`sell`), and sends a short notification to other occupants.

**Acceptance Scenarios**:

1. **Given** a player anywhere on the map, **When** they issue `guild`, **Then** DM confirms teleportation, lists current Guild services (including shop and crier instructions), and posts a short "player arrived" note to others already inside.
2. **Given** the DM/tick service is mid-combat with that player, **When** `guild` is issued, **Then** teleportation is refused with guidance to resolve combat first and no movement occurs.

---

### User Story 2 - Trade Items at Guild Market (Priority: P2)

Once in the Guild, adventurers want a structured shop experience to spend gold on curated items or sell loot for currency without buffer steps.

**Why this priority**: The Guild market is the primary retention hook for this space; without reliable trading, teleportation alone provides little value.

**Independent Test**: From the Guild, send `buy <item>` and `sell <item>` Slack commands (only available inside the Guild); verify gold balances, inventory changes, and confirmation receipts across DM and Slack logs.

**Acceptance Scenarios**:

1. **Given** a player in the Guild with enough gold, **When** they issue `buy <item>`, **Then** the DM deducts gold, adds the item to inventory, emits a receipt to the player, and broadcasts a short update to co-located players.
2. **Given** a player attempts to sell a qualifying item from their inventory, **When** they issue `sell <item>`, **Then** the DM removes the item, credits gold at the configured rate, and confirms the transaction.

---

### User Story 3 - Hear Town Crier Announcements (Priority: P3)

Players stationed at the Guild should hear narrated updates such as world events, system notices, or staff alerts so the hall feels alive.

**Why this priority**: Broadcast announcements drive community awareness and justify returning to the Guild beyond commerce.

**Independent Test**: Seed the announcements database table with sample rows and confirm that the automated town crier NPC pulls the latest entry, performs the narration in the Guild, and sends summarized digests to players outside—no admin command required.

**Acceptance Scenarios**:

1. **Given** a new announcement row exists in the database, **When** the automated town crier polls for updates, **Then** all Guild occupants get the full text and formatting while other online players receive a short "Town Crier" digest.
2. **Given** the DM scheduler triggers recurring announcement checks (e.g., hourly tips), **When** the cron fires, **Then** the EventBus dispatches the message once and Slack surfaces it without duplicates.

---

### Edge Cases

- What happens when a player with insufficient gold attempts to buy an item? They should receive a denial plus their balance and a prompt to earn more gold.
- How does the system handle simultaneous buy/sell commands on the same inventory item? The first confirmed request wins and later attempts return a "no longer available" notice.
- What happens when the Guild reaches a soft population limit? Provide a polite response and keep the player in place while queuing an invite.
- How does the shop behave when stock is empty? The response lists sold-out items separately and offers a restock timer if available.
- What if the automated town crier finds multiple announcements? Messages are ordered by priority and timestamp with rate limiting so Slack is not flooded.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST offer a Slack command (or shortcut) that teleports eligible players to the Guild Hall tile and confirms success/failure within 2 seconds.
- **FR-002**: System MUST display the current Guild services (shop catalog, town crier status, exits) whenever a player arrives or requests help, including abbreviated updates to other occupants.
- **FR-003**: System MUST enforce prerequisites (out-of-combat, not encumbered, cooldown timers) before teleporting or trading, returning actionable guidance when blocked.
- **FR-004**: System MUST provide a buy flow where players already in the Guild use `buy <item>` to select in-stock wares, see prices denominated in gold, confirm purchases, and receive receipts that include remaining balance and delivery destination.
- **FR-005**: System MUST allow selling eligible inventory back to the Guild shop via `sell <item>` at published rates, removing the item, crediting gold, and emitting an EventBus notification for downstream systems.
- **FR-006**: System MUST provide an automated town crier NPC that polls the announcements data store on a schedule, targets Guild occupants with full narratives, and non-Guild players with concise digests—no separate admin command is required yet.
- **FR-007**: System MUST log every teleport, purchase, sale, and announcement with correlation IDs plus success/failure status so incidents can be traced later.

### Key Entities _(include if feature involves data)_

- **Guild Hall**: Logical location with metadata (tile ID, access rules, population cap, available services) referenced whenever teleport or announcement actions occur.
- **Shop Catalog Entry**: Defines item name, description, buy price, sell price, stock count, eligibility tags, and restock cadence for use in Slack menus and DM transactions.
- **Player Balance & Inventory Snapshot**: Stores gold totals, carried items, encumbrance state, and any cooldown timers required before teleporting or trading.
- **Announcement Payload**: Contains speaker (system, admin, NPC), priority, message body, target audience (Guild occupants vs. global digest), and expiry window so EventBus consumers format Slack posts consistently.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 95% of `guild` teleport commands respond (success or actionable rejection) in under 2 seconds during load tests with at least 50 concurrent players.
- **SC-002**: 90% of shop transactions complete without manual GM intervention, and audit logs reconcile gold spent/earned within ±1 gold per player per day.
- **SC-003**: At least 80% of surveyed players report that Guild announcements keep them informed about world events (measured via in-Slack emoji reactions or feedback prompt within two weeks of launch).
- **SC-004**: Support tickets related to "missing shop items or currency" drop by 50% compared to the prior sprint due to clearer receipts and logs.

## Assumptions & Dependencies

- The Guild Hall already exists as a traversable tile; this feature layers teleport plus services without redesigning the underlying map.
- Gold is the sole tender for this phase; barter or premium currencies remain out of scope.
- Existing DM inventory and event systems can emit/consume additional EventBus payloads with only schema extensions (no new transport required).
- Town crier content lives in an existing database table populated by tooling outside this scope; the NPC simply fetches and broadcasts the latest approved messages.
