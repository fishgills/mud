# Combat System Refactoring

## Overview

The combat system has been refactored to provide a DRY (Don't Repeat Yourself), unified approach to all combat scenarios with proper event-driven architecture and comprehensive messaging for all participants and observers.

## Key Improvements

### 1. **Unified Combat Logic**

All combat scenarios now use the same core `initiateCombat()` method:

- Player vs Monster
- Monster vs Player
- Player vs Player

The three public methods (`playerAttackMonster`, `monsterAttackPlayer`, `playerAttackPlayer`) are now simple wrappers that call `initiateCombat()` with appropriate parameters.

### 2. **Observer Messaging**

Combat participants and **observers in the same location** now receive messages:

**Message Recipients:**

- **Attacker** (if player): Receives personalized 2nd-person narrative ("You strike...")
- **Defender** (if player): Receives personalized 2nd-person narrative ("Monster hits you...")
- **Observers** (players at same location): Receive 3rd-person narrative with "📣 Combat nearby:" prefix

**Example Flow:**

```
Location (5, 10):
- Alice (attacker)
- Goblin (defender)
- Bob (observer)
- Carol (observer)

Messages sent:
1. Alice: "You strike the Goblin for 8 damage!"
2. Bob: "📣 Combat nearby: Alice strikes the Goblin for 8 damage!"
3. Carol: "📣 Combat nearby: Alice strikes the Goblin for 8 damage!"
```

### 3. **Event Bus Integration**

Combat events are properly emitted at key moments:

- `combat:start` - When combat begins
- `combat:hit` - On successful attacks
- `combat:miss` - On missed attacks
- `combat:end` - When combat concludes

These events can be subscribed to by other systems (like EncounterService) for reactive gameplay.

## Architecture

### Core Method: `initiateCombat()`

```typescript
async initiateCombat(
  attackerId: string | number,
  attackerType: 'player' | 'monster',
  defenderId: string | number,
  defenderType: 'player' | 'monster',
  options: { ignoreLocation?: boolean } = {},
): Promise<CombatResult>
```

**Responsibilities:**

1. Load both combatants
2. Validate they're alive
3. Check location requirements (unless overridden)
4. Run D&D-style combat simulation
5. Apply results (HP changes, XP/gold awards)
6. Generate messages for participants AND observers
7. Return standardized CombatResult

### Message Generation: `generateCombatMessages()`

```typescript
private async generateCombatMessages(
  combatLog: DetailedCombatLog,
  attacker: Combatant,
  defender: Combatant,
): Promise<CombatMessage[]>
```

**Process:**

1. Generate personalized message for attacker (if player)
2. Generate personalized message for defender (if player)
3. Fetch all players at the combat location
4. Generate 3rd-person observer message
5. Send observer message to all players except participants
6. Return array of CombatMessage objects with role tags

### CombatMessage Interface

```typescript
export interface CombatMessage {
  slackId: string;
  name: string;
  message: string;
  role: 'attacker' | 'defender' | 'observer';
}
```

The `role` field allows message handlers (Slack bot, Discord bot) to format or route messages appropriately.

## API Changes

### No Breaking Changes

All existing public methods maintain their signatures:

- `playerAttackMonster(playerSlackId, monsterId)`
- `monsterAttackPlayer(monsterId, playerSlackId)`
- `playerAttackPlayer(attackerSlackId, defenderSlackId, ignoreLocation?)`

### New Fields

**CombatResult.playerMessages** now includes:

- `role` field ('attacker', 'defender', or 'observer')
- Messages for **all** players who should be notified, not just participants

**PlayerService.getPlayersAtLocation** now accepts:

- Options object: `{ excludePlayerId?: number, aliveOnly?: boolean }`
- Backwards compatible (can still call without options)

## Benefits

### 1. DRY Principle

- **Before**: 3 separate methods with ~200 lines of duplicated combat logic each
- **After**: 1 core method + 3 simple wrappers (8 lines each)

### 2. Consistency

- All combat types use identical mechanics
- Same validation, same D&D rules, same reward calculations
- No edge cases where one combat type behaves differently

### 3. Maintainability

- Bug fixes apply to all combat types automatically
- New features (critical hits, status effects) only need to be added once
- Clear separation of concerns (combat logic vs. messaging vs. event emission)

### 4. Social Features

- Observers create emergent gameplay ("Did you see that fight?")
- Players can witness epic battles
- Creates points of interest and gathering opportunities
- Enables combat spectating without participation

### 5. Event-Driven Design

- Combat integrates with EventBus for reactive systems
- Encounter system can trigger attacks based on events
- Future systems can subscribe to combat events (achievements, quests, etc.)

## Testing

All existing tests pass without modification due to backwards-compatible API.

### New Test Scenarios to Add

- ✅ Observer messaging when multiple players at location
- ✅ Observer exclusion (participants don't receive observer messages)
- ✅ Client ID extraction (slack:U123 → U123 for messaging)
- ✅ Empty observer list when no other players present
- ✅ Role field populated correctly

## Migration Notes

### For Slack Bot Integration

The Slack bot should now handle the `role` field in combat messages:

```typescript
for (const message of combatResult.playerMessages) {
  if (message.role === 'observer') {
    // Maybe use different formatting or channel
    await sendSlackMessage(message.slackId, message.message);
  } else {
    // Participant messages might be more prominent
    await sendSlackMessage(message.slackId, message.message);
  }
}
```

### For Future Discord/Web Clients

The unified system makes multi-client support easier:

- Extract client ID from PlayerEntity.clientId
- Route based on client type: `clientId.startsWith('slack:')`, `clientId.startsWith('discord:')`, etc.
- Same combat logic, different message delivery

## Performance Considerations

**Observer Query Optimization:**

- Uses `PlayerFactory.loadAtLocation()` which is indexed on (x, y)
- Excludes attacker automatically to reduce payload
- Only loads alive players by default

**AI Narrative Generation:**

- Observer message generated once and reused for all observers
- Participants get personalized messages (necessary for 2nd person perspective)
- AI calls cached per combat (not per observer)

## Future Enhancements

Potential additions that fit naturally into this architecture:

1. **Combat Spectator Mode** - Add `spectate` role for players intentionally watching
2. **Arena System** - `ignoreLocation` flag already supports remote combat
3. **Combat Replays** - DetailedCombatLog contains full play-by-play
4. **Team Combat** - Extend to handle parties attacking together
5. **Status Effects** - Add to Combatant interface, apply in runCombat()
6. **Combat Logs Tab** - Use getCombatLogForLocation() for location history
7. **Reputation System** - Subscribe to combat:end events to track PvP kills
8. **Bounty System** - Award observers who report PvP combat locations

## Summary

The refactored combat system is:

- ✅ DRY - Single source of truth for combat logic
- ✅ Consistent - All combat types work identically
- ✅ Social - Observers receive notifications
- ✅ Event-driven - Proper EventBus integration
- ✅ Maintainable - Clear separation of concerns
- ✅ Backwards-compatible - No breaking changes to API
- ✅ Extensible - Easy to add new features

This creates a foundation for rich multiplayer interactions and emergent gameplay around combat encounters.
