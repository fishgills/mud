# Migration Plan: Multi-Client Support

## Goal

Enable multiple clients (Slack, Discord, Web) to share a single world by refactoring the Player model to be client-agnostic.

## Current State

```prisma
model Player {
  slackId String @unique  // ❌ Slack-specific
  // ...
}
```

All code uses `slackId` throughout the codebase.

## Target State

```prisma
model Player {
  clientId   String @unique  // ✅ "slack:U123" or "discord:456"
  clientType String          // ✅ "slack", "discord", "web"
  // ...
}
```

## Migration Strategy: **Gradual Migration with Backwards Compatibility**

We'll migrate in phases to avoid breaking existing functionality:

### Phase 1: Add New Fields (Non-Breaking) ✅ RECOMMENDED NEXT

1. **Add new columns** to Player table:

   ```prisma
   model Player {
     slackId    String  @unique         // Keep for backwards compat
     clientId   String? @unique         // New: "slack:U123"
     clientType String? @default("slack") // New: "slack", "discord", "web"
     // ...
   }
   ```

2. **Create migration** that:
   - Adds `clientId` and `clientType` columns (nullable initially)
   - Backfills existing players: `clientId = 'slack:' + slackId`
   - Sets `clientType = 'slack'` for all existing players

3. **Update factories** to populate both fields:

   ```typescript
   // PlayerFactory
   const player = await prisma.player.create({
     data: {
       slackId: clientId, // Backwards compat
       clientId: `slack:${clientId}`, // New field
       clientType: 'slack', // New field
       // ...
     },
   });
   ```

4. **Update queries** to use `clientId` OR `slackId`:
   ```typescript
   // Support both old and new
   const player = await prisma.player.findFirst({
     where: {
       OR: [{ clientId: fullClientId }, { slackId: platformId }],
     },
   });
   ```

### Phase 2: Update Client Code

1. **Slack adapter** starts passing full `clientId`:

   ```typescript
   // Old: slackId: "U123"
   // New: clientId: "slack:U123", clientType: "slack"
   ```

2. **GraphQL schema** adds client-agnostic fields:

   ```graphql
   input CreatePlayerInput {
     clientId: String! # "slack:U123"
     clientType: ClientType! # SLACK, DISCORD, WEB
     name: String!
     # Keep slackId for backwards compat (deprecated)
     slackId: String @deprecated(reason: "Use clientId")
   }
   ```

3. **Update all GraphQL mutations/queries** to accept both

### Phase 3: Deprecate Old Fields

1. Make `slackId` optional (but still keep it)
2. Add deprecation warnings in logs when `slackId` is used
3. Update all internal code to use `clientId`

### Phase 4: Remove Old Fields (Future)

Once all clients use new fields:

1. Remove `slackId` column
2. Remove backwards-compat code
3. Clean up migrations

## Implementation: Phase 1

### Step 1: Update Prisma Schema

```prisma
model Player {
  id           Int           @id @default(autoincrement())
  slackId      String?       @unique // Made optional (backwards compat)
  clientId     String?       @unique // New: full client ID
  clientType   String?       @default("slack") // New: client type
  name         String
  // ... rest of fields
}
```

### Step 2: Create Migration

```bash
cd libs/database
npx prisma migrate dev --name add_client_id_fields
```

This will:

- Add `clientId` and `clientType` columns
- Keep `slackId` for backwards compatibility

### Step 3: Backfill Data

Create a migration script:

```typescript
// libs/database/scripts/backfill-client-ids.ts
import { getPrismaClient } from '../src';

async function backfillClientIds() {
  const prisma = getPrismaClient();

  // Find all players without clientId
  const players = await prisma.player.findMany({
    where: { clientId: null },
  });

  console.log(`Backfilling ${players.length} players...`);

  for (const player of players) {
    await prisma.player.update({
      where: { id: player.id },
      data: {
        clientId: `slack:${player.slackId}`,
        clientType: 'slack',
      },
    });
  }

  console.log('Backfill complete!');
}

backfillClientIds();
```

### Step 4: Update PlayerFactory

```typescript
// libs/engine/src/factories/player-factory.ts
static async create(options: CreatePlayerOptions): Promise<PlayerEntity> {
  const { clientId, clientType, name, x, y } = options;

  const stats = this.generateRandomStats();

  const player = await this.prisma.player.create({
    data: {
      // Support both old and new
      slackId: clientId, // Backwards compat
      clientId: `${clientType}:${clientId}`, // New format
      clientType, // New field
      name,
      x: x ?? 0,
      y: y ?? 0,
      // ...
    },
  });

  return this.fromDatabaseModel(player, clientType);
}

static async load(
  clientId: string,
  clientType: ClientType,
): Promise<PlayerEntity | null> {
  const fullClientId = `${clientType}:${clientId}`;

  const player = await this.prisma.player.findFirst({
    where: {
      OR: [
        { clientId: fullClientId }, // Try new format first
        { slackId: clientId }, // Fallback to old format
      ],
    },
  });

  if (!player) {
    return null;
  }

  return this.fromDatabaseModel(player, clientType);
}
```

### Step 5: Update GraphQL Schema

```graphql
# dm-schema.gql
enum ClientType {
  SLACK
  DISCORD
  WEB
}

input CreatePlayerInput {
  # New fields (preferred)
  clientId: String
  clientType: ClientType

  # Legacy field (deprecated)
  slackId: String @deprecated(reason: "Use clientId with clientType")

  name: String!
  x: Int
  y: Int
}
```

## Timeline

- **Week 1**: Phase 1 - Add new fields, backfill data ← **START HERE**
- **Week 2**: Update PlayerFactory and @mud/engine
- **Week 3**: Update GraphQL schema and DM service
- **Week 4**: Update Slack adapter to use new format
- **Week 5**: Add Discord adapter (using new format)
- **Week 6**: Add Web adapter (using new format)
- **Future**: Remove `slackId` field entirely

## Testing Strategy

1. **Add tests** for both old and new formats
2. **Test backwards compatibility**: Ensure existing Slack users work
3. **Test new clients**: Create Discord test account
4. **Test cross-platform party**: Slack + Discord users in same party

## Rollback Plan

If something goes wrong:

1. `clientId` and `clientType` are nullable, so old code still works
2. Can revert migration if needed
3. Backfill script is idempotent (can run multiple times)

## Benefits

✅ Zero downtime migration
✅ Backwards compatible with existing Slack users  
✅ Easy to add new clients (Discord, Web)  
✅ Single world shared by all platforms  
✅ Can migrate users between platforms if needed

## Next Steps

Want me to implement Phase 1? I can:

1. Update the Prisma schema
2. Create the migration
3. Create the backfill script
4. Update PlayerFactory to support both formats
