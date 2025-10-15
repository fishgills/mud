# Feature Specification: Equipment System — Armor Slots and Weapon for Player Characters

**Feature Branch**: `001-for-player-characters`  
**Created**: 2025-10-15  
**Status**: Draft  
**Input**: User description: "For player characters, we need to add support for items. Helmets, torso, legs, and a weapon just to start. Armor should affect a player's defense."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Equip core gear (Priority: P1)

Players can equip a helmet, torso armor, leg armor, and a weapon to their character to increase survivability.

**Why this priority**: Core progression loop; enables meaningful impact on combat outcomes.

**Independent Test**: Start with a character and one equippable item; after equip, defense increases and is used to reduce incoming damage in combat.

**Acceptance Scenarios**:

1. Given a character with base defense and a helmet in inventory, When the player equips the helmet, Then the character’s total defense increases by the helmet’s armor value and is reflected in stats.
2. Given an equipped torso item, When the player replaces it with another torso item, Then the new item is equipped, the old item returns to inventory, and defense updates accordingly.

---

### User Story 2 - View equipment and stats impact (Priority: P2)

Players can view currently equipped items by slot and see total defense and per-item contributions.

**Why this priority**: Transparency builds trust; enables informed gear choices.

**Independent Test**: With multiple equipped items, viewing equipment shows each slot, item names, and total defense breakdown.

**Acceptance Scenarios**:

1. Given items equipped in helmet, torso, legs, and weapon slots, When the player views equipment, Then each slot shows the equipped item (or empty) and total defense shows base + armor contributions.

---

### User Story 3 - Unequip and swap (Priority: P3)

Players can unequip items or swap them directly from inventory.

**Why this priority**: Supports experimentation without penalty.

**Independent Test**: Unequipping reduces defense by the item’s armor value; swapping applies the delta accordingly.

**Acceptance Scenarios**:

1. Given a character with an equipped legs item, When the player unequips it, Then the slot becomes empty, the item returns to inventory, and total defense decreases by that item’s armor value.

---

### Edge Cases

- Equipping an item whose slot is already occupied: system swaps and returns the replaced item to inventory.
- Attempting to equip an item to the wrong slot: operation is rejected with a clear message.
- Equipping an item not in inventory: operation is rejected.
- Items with zero or negative armor values: zero is allowed (cosmetic), negative is rejected.
- Weapon slot provides no defense by default (no negative effect on defense).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST define the following equipment slots: `helmet`, `torso`, `legs`, `weapon`.
- **FR-002**: Items MUST declare a slot type and an armor value (non-negative integer); weapon armor value defaults to 0.
- **FR-003**: Players MUST be able to equip an item into the matching slot only if the item is in their inventory and the character meets any item constraints (e.g., level if applicable).
- **FR-004**: If a slot is occupied, equipping MUST swap: the new item is equipped and the previous item returns to inventory.
- **FR-005**: Players MUST be able to unequip an item from any slot; the item returns to inventory.
- **FR-006**: The system MUST compute Total Defense as: Base Defense + sum of armor values from equipped `helmet`, `torso`, and `legs` slots. The `weapon` slot does not contribute to defense by default.
- **FR-007**: Combat calculations MUST use Total Defense to reduce damage from incoming attacks in a predictable, repeatable way such that adding armor decreases damage taken by the armor amount under the same attack conditions.
- **FR-008**: Players MUST be able to view equipment by slot and see Total Defense and per-item armor contributions.
- **FR-009**: Equipment state and resulting Total Defense MUST persist across sessions/turns.
- **FR-010**: The system MUST reject invalid operations (wrong slot, missing item, negative armor) with user-friendly messages.

### Key Entities _(include if feature involves data)_

- **PlayerCharacter**: identity, baseDefense, equippedSlots{helmet?, torso?, legs?, weapon?}, totalDefense.
- **Item**: id, name, slotType(one of helmet|torso|legs|weapon), armorValue(>=0), optional metadata (rarity, description).
- **EquipmentSlot**: enumeration of allowed slots and their rules (one item per slot, matching types only).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Equipping an armor item with armorValue X reduces damage taken from a fixed baseline attack by exactly X (within deterministic test setup).
- **SC-002**: Viewing equipment shows all four slots and a correct Total Defense equal to Base Defense + sum(armor values) for 100% of tested combinations.
- **SC-003**: Equip/unequip/swap operations complete via a single user command each and reflect in stats within one turn/action.
- **SC-004**: After logout/restart, previously equipped items and Total Defense are preserved for 100% of tested characters.
