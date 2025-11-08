# DM API Refactor TODO

## Overview

Currently, the DM API endpoints accept a combined `slackId` parameter in the format `"teamId:userId"` (e.g., `"TB1QW3SQH:UB389SP46"`). While this works, it would be cleaner to accept separate `teamId` and `userId` parameters directly.

## Current State

### Backend (DM Service)

- ✅ `PlayerService` internally uses player-lookup service (`findPlayerBySlackUser`)
- ✅ `getPlayer`, `getPlayerByClientId`, `getPlayerByName` parse the combined string and query SlackUser table
- ✅ Database queries use proper joins via SlackUser table (no string parsing at DB level)
- ✅ One endpoint (`getPlayerItems`) updated to accept separate `teamId`/`userId` parameters with backward compatibility

### Frontend (Slack Service)

- ✅ Removed `toClientId` utility function
- ✅ All handlers construct `${teamId}:${userId}` inline
- ✅ One handler (`inventory`) updated to pass separate parameters

## Remaining Work

### Phase 1: Update DM API Endpoints

Update all remaining endpoints to accept both formats:

- Old format: `slackId` parameter with combined string
- New format: separate `teamId` and `userId` parameters

**Pattern:**

```typescript
@Get('endpoint')
async someEndpoint(
  @Query('slackId') slackId?: string,
  @Query('clientId') clientId?: string,
  @Query('teamId') teamId?: string,
  @Query('userId') userId?: string,
): Promise<SomeResponse> {
  // Construct effective slackId from new params if provided
  const effectiveSlackId = teamId && userId
    ? `${teamId}:${userId}`
    : slackId;

  const player = await this.playerService.getPlayerByIdentifier({
    slackId: effectiveSlackId,
    clientId,
  });
  // ... rest of logic
}
```

**Endpoints to update:**

#### Player Controller (`apps/dm/src/app/api/controllers/player.controller.ts`)

- ✅ `getPlayerItems` (lines 613-640) - COMPLETED
- [ ] `createPlayer` (lines 75-98) - `@Body() input: CreatePlayerRequest`
- [ ] `getPlayer` (lines 121-164) - GET with `slackId?`, `clientId?`, `name?`
- [ ] `updatePlayerStats` (lines 192-214) - POST `@Body() payload: StatsUpdatePayload`
- [ ] `incrementAttribute` (lines 216-243) - POST `@Body() payload: AttributePayload`
- [ ] `rerollPlayerStats` (lines 245-261) - POST `@Body() payload: { slackId: string }`
- [ ] `completePlayer` (lines 263-291) - POST `@Body() payload: { slackId: string }`
- [ ] `deletePlayer` (lines 293-310) - DELETE `@Body() payload: { slackId: string }`
- [ ] `movePlayer` (lines 312-350) - POST with `slackId` in body
- [ ] `respawn` (lines 329-350) - POST `@Body() payload: { slackId: string }`
- [ ] `getPlayerInventory` (lines 352-377) - GET with `slackId?`
- [ ] `attack` (lines 379-445) - POST `@Body() payload: AttackPayload`
- [ ] `takeDamage` (lines 447-474) - POST `@Body() payload: DamagePayload`
- [ ] `heal` (lines 476-503) - POST `@Body() payload: ValuePayload`
- [ ] `addGold` (lines 505-532) - POST `@Body() payload: ValuePayload`
- [ ] `removeGold` (lines 534-561) - POST `@Body() payload: ValuePayload`
- [ ] `addXp` (lines 563-608) - POST `@Body() payload: ValuePayload`
- [ ] `pickup` (lines 693-741) - POST with `slackId?`, `clientId?`, `worldItemId?`
- [ ] `drop` (lines 743-780) - POST with `slackId?`, `clientId?`, `playerItemId?`
- [ ] `equip` (lines 782-820) - POST with `slackId?`, `clientId?`, `playerItemId?`
- [ ] `unequip` (lines 822-830) - POST with `slackId`, `playerItemId`

#### Other Controllers

- [ ] Check for any other controllers that accept `slackId` parameters

### Phase 2: Update DM Client (`apps/slack/src/dm-client.ts`)

Update all function signatures to accept both formats:

**Pattern:**

```typescript
export async function someFunction(params: {
  teamId?: string;
  userId?: string;
  slackId?: string;
  clientId?: string;
  // ... other params
}): Promise<SomeResponse> {
  return dmRequest<SomeResponse>('/endpoint', HttpMethod.POST, {
    body: {
      teamId: params.teamId,
      userId: params.userId,
      slackId: params.slackId,
      clientId: params.clientId,
      // ... other params
    },
  });
}
```

**Functions to update:**

- ✅ `getPlayerItems` - COMPLETED
- [ ] `createPlayer`
- [ ] `getPlayer`
- [ ] `rerollPlayerStats`
- [ ] `completePlayer`
- [ ] `deletePlayer`
- [ ] `movePlayer`
- [ ] `attack`
- [ ] `getLookView`
- [ ] `pickup`
- [ ] `drop`
- [ ] `equip`
- [ ] `unequip`
- [ ] `sniff`
- [ ] `getLeaderboard` (already uses teamId!)

### Phase 3: Update Slack Handlers

Replace all inline `slackId: \`${teamId}:${userId}\`` with separate parameters:

**Files to update:**

- [ ] `handlers/attack.ts` (1 occurrence)
- [ ] `handlers/create.ts` (1 occurrence)
- [ ] `handlers/complete.ts` (1 occurrence)
- [ ] `handlers/reroll.ts` (1 occurrence)
- [ ] `handlers/delete.ts` (2 occurrences)
- [ ] `handlers/look.ts` (1 occurrence)
- [ ] `handlers/map.ts` (1 occurrence)
- [ ] `handlers/move.ts` (1 occurrence)
- [ ] `handlers/inspect.ts` (5 occurrences)
- ✅ `handlers/inventory.ts` - COMPLETED
- [ ] `handlers/pickup.ts` (3 occurrences)
- [ ] `handlers/drop.ts` (1 occurrence)
- [ ] `handlers/equip.ts` (1 occurrence)
- [ ] `handlers/sniff.ts` (1 occurrence)
- [ ] `handlers/stats/index.ts` (2 occurrences)
- [ ] `handlers/stats/lookup.ts` (1 occurrence)

### Phase 4: Update Slack Actions

Replace all inline `slackId: \`${teamId}:${userId}\`` in action handlers:

**Files to update:**

- [ ] `actions/attackActions.ts` (1 occurrence)
- [ ] `actions/inventoryActions.ts` (3 occurrences)
- [ ] `actions/pickupActions.ts` (2 occurrences)
- [ ] `actions/statActions.ts` (1 occurrence)

### Phase 5: Deprecate Combined Format

Once all code is updated:

1. Mark `slackId` parameter as deprecated in API docs
2. Consider removing backward compatibility after a grace period
3. Update DTOs to make `teamId` and `userId` required
4. Remove string parsing logic from `PlayerService.getPlayer`/`getPlayerByClientId`

## Benefits of This Refactor

1. **Cleaner API contracts** - Explicit parameters instead of encoded strings
2. **Type safety** - TypeScript can validate teamId and userId separately
3. **Better documentation** - API docs clearly show what data is needed
4. **Easier testing** - Mock data doesn't need string formatting
5. **Future flexibility** - Easy to add validation or change ID formats per field

## Notes

- Maintain backward compatibility during transition
- The database layer (via player-lookup service) already handles this correctly
- String parsing only happens at API boundary, not at database level
- Consider making this change as part of a broader API versioning strategy (v2?)
