# Quickstart — Equipment Feature

## Slack Bot (Bolt)

- Commands:
  - /equip <slot> <item name or id>
  - /unequip <slot>
  - /gear (view equipment)
- On command, call DM endpoints from contracts/equipment.openapi.yml.

## DM Service (NestJS)

- Add EquipmentModule with controller/service and DTOs.
- Compute Total Defense = baseDefense + armor(helmet+torso+legs). Weapon contributes 0.

## Testing

- Write unit tests for service logic (equip, swap, unequip, totals).
- Integration tests for REST endpoints.
- Slack command handlers mocked to call DM and render responses.
