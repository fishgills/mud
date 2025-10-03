# DM Service Event Integration

## Overview

The DM service now leverages the `@mud/engine` EventBus to emit game events for all significant player and combat actions. This enables:

- **Observability**: All game actions are logged via events for analytics and monitoring
- **Decoupling**: Other systems can listen to events without tight coupling to DM service
- **Extensibility**: Easy to add features like real-time notifications, achievements, quests, AI triggers
- **Consistency**: Follows the RanvierMUD event-driven pattern that `@mud/engine` is based on

## Events Emitted

### Player Lifecycle Events

#### `player:spawn`

- **Emitted by**: `PlayerFactory.create()` (in `@mud/engine`)
- **When**: New player is created
- **Data**: Player database model, spawn coordinates, timestamp
- **Location**: Already implemented in PlayerFactory

#### `player:move`

- **Emitted by**: `PlayerService.movePlayer()`
- **When**: Player moves to a new location
- **Data**: Player database model, from coordinates (fromX, fromY), to coordinates (toX, toY), timestamp
- **Use cases**: Track player movement, update client views, trigger location-based events

#### `player:death`

- **Emitted by**: `PlayerService.damagePlayer()`
- **When**: Player HP drops to 0 or below
- **Data**: Player database model, timestamp
- **Use cases**: Trigger death notifications, update leaderboards, spawn respawn timer

#### `player:respawn`

- **Emitted by**: `PlayerService.respawnPlayer()`
- **When**: Dead player is respawned
- **Data**: Player database model, respawn coordinates, timestamp
- **Use cases**: Notify players, update client state, log respawn events

#### `player:levelup`

- **Emitted by**: `PlayerService.updatePlayerStats()`
- **When**: Player gains enough XP to level up
- **Data**: Player database model, new level, skill points gained, timestamp
- **Use cases**: Congratulations notifications, achievement tracking, analytics

### Combat Events

#### `combat:start`

- **Emitted by**: `CombatService.runCombat()`
- **When**: Combat begins between two entities
- **Data**: Attacker combatant object {type, id}, defender combatant object {type, id}, location (x, y), timestamp
- **Use cases**: Notify nearby players, start combat animations, log combat initiation

#### `combat:hit`

- **Emitted by**: `CombatService.runCombat()` (per attack)
- **When**: An attack successfully hits
- **Data**: Attacker {type, id, name}, defender {type, id, name}, damage dealt, location (x, y), timestamp
- **Use cases**: Real-time combat updates, damage visualization, analytics

#### `combat:miss`

- **Emitted by**: `CombatService.runCombat()` (per attack)
- **When**: An attack misses
- **Data**: Attacker {type, id, name}, defender {type, id, name}, timestamp
- **Use cases**: Combat log completeness, miss rate analytics

#### `combat:end`

- **Emitted by**: `CombatService.runCombat()`
- **When**: Combat concludes with a winner
- **Data**: Winner {type, id}, loser {type, id}, XP gained, gold gained, timestamp
- **Use cases**: Award notifications, leaderboard updates, combat analytics

### Monster Events

#### `monster:spawn`

- **Emitted by**: `MonsterFactory.create()` (in `@mud/engine`)
- **When**: New monster is spawned in the world
- **Data**: Monster database model, spawn coordinates, timestamp
- **Location**: Already implemented in MonsterFactory

## Implementation Details

### Event Emission Pattern

Events are emitted using the `EventBus.emit()` method from `@mud/engine`:

```typescript
import { EventBus } from '@mud/engine';

// Emit player move event
await EventBus.emit({
  eventType: 'player:move',
  player: dbPlayer,
  fromX: oldX,
  fromY: oldY,
  toX: newX,
  toY: newY,
  timestamp: new Date(),
});
```

### Database Model Conversion

Events require database models (Prisma types) rather than entities. The service converts entities to database models before emitting:

```typescript
// Load fresh database model for event
const dbPlayer = await this.prisma.player.findUnique({
  where: { id: player.id },
});
if (dbPlayer) {
  await EventBus.emit({
    eventType: 'player:death',
    player: dbPlayer,
    timestamp: new Date(),
  });
}
```

### Combatant Objects

Combat events use combatant objects with `type` and `id` fields:

```typescript
await EventBus.emit({
  eventType: 'combat:start',
  attacker: { type: combatant1.type, id: combatant1.id },
  defender: { type: combatant2.type, id: combatant2.id },
  x: combatant1.x,
  y: combatant1.y,
  timestamp: new Date(),
});
```

## Event Listening

To listen to events in other services, use `EventBus.on()`:

```typescript
import { EventBus } from '@mud/engine';

// Listen to player movement
EventBus.on('player:move', async (event) => {
  console.log(`${event.player.name} moved from (${event.fromX}, ${event.fromY}) to (${event.toX}, ${event.toY})`);
});

// Listen to all combat events
EventBus.onAny(async (event) => {
  if (event.eventType.startsWith('combat:')) {
    console.log('Combat event:', event);
  }
});
```

## Future Extensions

With events now emitted, the following features can be easily added:

1. **Real-time Notifications**: Listen to events and send Slack/Discord messages
2. **Analytics Dashboard**: Track player activity, combat statistics, movement patterns
3. **Achievement System**: Listen for specific event patterns (e.g., 10 wins, visited 100 locations)
4. **Quest System**: Trigger quest progress on events (e.g., "Kill 5 goblins")
5. **AI Narrator**: Generate dynamic descriptions based on events
6. **Leaderboards**: Update rankings based on combat results and leveling
7. **World State**: Update shared world state based on player actions
8. **Webhooks**: Send events to external services for integrations

## Testing Events

To test event emission in unit tests:

```typescript
import { EventBus } from '@mud/engine';

// Mock EventBus.emit
const emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue();

// Run test
await playerService.movePlayer('U123', { direction: 'n' });

// Assert event was emitted
expect(emitSpy).toHaveBeenCalledWith(
  expect.objectContaining({
    eventType: 'player:move',
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 1,
  }),
);
```

## Related Files

- **Event Definitions**: `libs/engine/src/events/game-events.ts`
- **EventBus Implementation**: `libs/engine/src/events/event-bus.ts`
- **Player Events**: `apps/dm/src/app/player/player.service.ts`
- **Combat Events**: `apps/dm/src/app/combat/combat.service.ts`
- **Monster Events**: `libs/engine/src/factories/monster-factory.ts`
- **Player Factory Events**: `libs/engine/src/factories/player-factory.ts`
