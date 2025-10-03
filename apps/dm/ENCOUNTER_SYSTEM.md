# Monster Encounter System

## Overview

The monster encounter system adds dynamic combat encounters when players move into tiles occupied by monsters. The system uses an event-driven architecture built on the `@mud/engine` EventBus.

## How It Works

### Event Flow

1. **Player Movement** → Player moves to a new tile
2. **`player:move` event** → PlayerService emits this event after successful movement
3. **EncounterService listener** → Detects the event and checks for monsters at the destination
4. **`monster:encounter` event** → Emitted when monsters are found at the player's location
5. **Attack Roll** → For each monster, calculate attack chance based on agility
6. **Combat Initiation** → If roll succeeds, trigger `CombatService.monsterAttackPlayer()`

### Attack Chance Formula

The probability that a monster attacks is based on its agility attribute:

```
attackChance = min(agility × 5, 95)
```

**Examples:**

- Agility 5 → 25% chance to attack
- Agility 10 → 50% chance to attack
- Agility 15 → 75% chance to attack
- Agility 19+ → 95% chance (capped, never 100% certain)

This makes agile monsters more aggressive and likely to engage players who enter their territory.

## Architecture

### New Event Type

Added `MonsterEncounterEvent` to `libs/engine/src/events/game-events.ts`:

```typescript
export interface MonsterEncounterEvent extends BaseGameEvent {
  eventType: 'monster:encounter';
  player: Player;
  monsters: Monster[];
  x: number;
  y: number;
}
```

### EncounterService

**Location:** `apps/dm/src/app/encounter/encounter.service.ts`

**Responsibilities:**

- Listen to `player:move` events
- Check for monsters at the player's new location
- Emit `monster:encounter` events
- Calculate attack probability for each monster
- Trigger combat when attack roll succeeds

**Key Methods:**

- `onModuleInit()` - Registers the event listener on app startup
- `handlePlayerMove()` - Processes player movement and checks for encounters
- `calculateAttackChance()` - Computes attack probability based on agility

### Integration

The service is registered in `app.module.ts` as a provider, which ensures:

- Automatic initialization via `OnModuleInit` interface
- Dependency injection of MonsterService and CombatService
- Event listener registration when the app starts

## Testing

Comprehensive test suite at `apps/dm/src/app/encounter/encounter.service.spec.ts` covers:

✅ Event listener registration  
✅ No encounters when no monsters present  
✅ Monster encounter event emission  
✅ Attack chance calculation (0-95% based on agility)  
✅ Combat triggering on successful rolls  
✅ No combat on failed rolls  
✅ Multiple monster handling  
✅ Null slackId handling  
✅ Error handling

All 9 tests passing.

## Usage

The system works automatically once the DM service is running:

1. Player moves to a new location (via MovementResolver or PlayerService)
2. If monsters are present, they may attack based on their agility
3. Combat is resolved using the existing CombatService
4. Player receives combat results through normal channels (Slack bot, etc.)

## Benefits

- **Event-driven design** - Loose coupling between movement, encounters, and combat
- **Configurable difficulty** - Monster agility determines aggression
- **Probabilistic gameplay** - Not all encounters result in combat
- **Scalable** - Can easily add more encounter types or conditions
- **Testable** - Clean separation of concerns makes testing straightforward

## Future Enhancements

Potential improvements:

- Add monster temperament types (passive, neutral, aggressive)
- Time-of-day modifiers (monsters more aggressive at night)
- Player stealth/agility checks to avoid detection
- Terrain-based encounter modifiers
- Monster group behavior (pack tactics)
- Encounter cooldowns to prevent spam attacks
