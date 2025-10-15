# Data Model — Equipment System

## Entities

### PlayerCharacter

- id (uuid/string)
- baseDefense (int >= 0)
- equippedSlots: { helmet?: ItemRef, torso?: ItemRef, legs?: ItemRef, weapon?: ItemRef }
- totalDefense (derived; not stored if computed on read)

### Item

- id (uuid/string)
- name (string)
- slotType (enum: helmet | torso | legs | weapon)
- armorValue (int >= 0; default 0; weapon items SHOULD be 0)
- metadata (optional: rarity, description)

### ItemRef

- itemId (string)
- name (string)
- armorValue (int)

## Rules & Validation

- slotType must match the destination slot.
- Only one item per slot.
- armorValue must be non-negative.
- Total Defense = baseDefense + sum(armorValue of equipped helmet/torso/legs).

## Relationships

- PlayerCharacter 1 — many Inventory Items.
- Inventory contains Items not currently equipped.
