# Mud Architecture: Multi-Client, Single World

## Overview

Our architecture uses a **hybrid microservices approach** where client-specific services (Slack, Discord, Web) communicate with a shared game engine service, ensuring all players interact in a single, unified world.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
├─────────────┬─────────────┬─────────────┬─────────────────┤
│   Slack     │   Discord   │     Web     │   (Future)      │
│   Adapter   │   Adapter   │   Adapter   │   Adapters      │
│  (Cloud Run)│  (Cloud Run)│  (Cloud Run)│                 │
└──────┬──────┴──────┬──────┴──────┬──────┴─────────────────┘
       │             │             │
       │  REST/ts    │  REST/ts    │  REST/WebSocket
       │             │             │
       └─────────────┼─────────────┘
                     ↓
       ┌─────────────────────────────┐
       │    Game Engine Service      │
       │         (@mud/dm)           │
       │                             │
       │  ┌──────────────────────┐  │
       │  │  @mud/engine         │  │  ← Client-agnostic
       │  │  (Core Logic)        │  │     game logic
       │  └──────────────────────┘  │
       │                             │
       │  • Player Management        │
       │  • Combat System            │
       │  • Monster AI               │
       │  • Event Bus                │
       │  • Party System             │
       └──────────┬──────────────────┘
                  │
       ┌──────────┼──────────────────┐
       ↓          ↓                  ↓
┌─────────┐  ┌─────────┐      ┌─────────┐
│   DB    │  │  Redis  │      │  World  │
│(Prisma) │  │ (Cache) │      │ Service │
└─────────┘  └─────────┘      └─────────┘
```

## Service Responsibilities

### Client Adapters (Slack, Discord, Web)

**Purpose**: Translate client-specific I/O to/from game engine API

**Responsibilities**:

- Receive commands from their respective platforms
- Parse/validate input in client-specific format
- Call game engine REST API defined via ts-rest contracts
- Format responses for their platform (Slack blocks, Discord embeds, HTML)
- Handle platform-specific auth (Slack tokens, Discord OAuth, JWT)
- Send notifications back to users

**Does NOT**:

- Contain game logic
- Access database directly (except for client-specific data like Slack tokens)
- Manage world state

**Example Flow (Slack)**:

```typescript
// Slack user types: /move north
1. Slack adapter receives slash command
2. Validates Slack signature
3. Calls DM service: `POST /players/move` with body `{ "slackId": "slack:U123", "input": { "direction": "north" } }`
4. Receives response with player state + nearby entities
5. Formats as Slack blocks
6. Responds to Slack
```

### Game Engine Service (@mud/dm)

**Purpose**: Single source of truth for game state and logic

**Responsibilities**:

- All game logic (combat, movement, leveling, spawning)
- World state management
- Monster AI and behaviors
- Party management
- Event emission (for AI generation, notifications)
- ts-rest API for client adapters

**Key Insight**: This service doesn't care if a player is from Slack, Discord, or Web. It just knows:

- `clientId` (e.g., "slack:U123" or "discord:456" or "web:session-abc")
- `clientType` enum

### World Service (@mud/world)

**Purpose**: Procedural world generation

**Responsibilities**:

- Generate tiles on-demand
- Cache tile descriptions
- Settlement/landmark generation

### Tick Service (@mud/tick)

**Purpose**: Advance game time

**Responsibilities**:

- Call DM service to process game tick
- Trigger monster movement
- Weather changes
- Time advancement

## Communication Patterns

### Client → Game Engine (ts-rest REST API)

All client adapters share a centralized ts-rest contract to communicate with the DM
service. Requests are standard JSON over HTTPS. Examples:

```http
POST /players/move
Content-Type: application/json

{
  "slackId": "slack:U123",
  "input": { "direction": "north" }
}
```

```http
GET /players?slackId=slack:U123
Accept: application/json
```

Responses return a `success` flag, optional `message`, and typed data payloads defined by Zod schemas shared across services.

### Game Engine → Clients (Server-Sent Events / Push)

For real-time notifications (e.g., "A goblin appeared!", "Player joined your party"):

**Option A**: Polling (Slack's current limitation)

- Slack adapter polls for events every 30s

**Option B**: WebSocket (Discord, Web)

- Subscribe to events via WebSocket
- Push notifications immediately

**Option C**: Webhooks

- Game engine calls webhook URLs registered by client adapters

### Internal Service Communication

- **Authentication**: GCP Cloud Run service-to-service auth (OIDC tokens)
- **Protocol**: REST over HTTPS (ts-rest contract)
- **Error Handling**: Retry with exponential backoff

## Database Schema Considerations

### Single World = Single Database

All clients share:

- `Player` table (with `clientId` and `clientType`)
- `Monster` table
- `Party` table
- `Settlement` table
- `WorldTile` table

### Client-Specific Data

Each client adapter may have its own table for platform-specific data:

```prisma
// In @mud/database schema
model Player {
  id         Int    @id @default(autoincrement())
  clientId   String @unique  // "slack:U123" or "discord:456"
  clientType String          // "slack", "discord", "web"
  name       String
  // ... game data
}

// Optional: Client-specific tables
model SlackUser {
  slackId     String @id
  teamId      String
  accessToken String
  player      Player @relation(fields: [playerId], references: [id])
  playerId    Int    @unique
}

model DiscordUser {
  discordId   String @id
  guildId     String
  player      Player @relation(fields: [playerId], references: [id])
  playerId    Int    @unique
}
```

## Deployment Strategy

### Cloud Run Services

1. **mud-dm** (Game Engine)
   - Handles all game logic
   - Exposes REST API backed by ts-rest contracts
   - Autoscales based on request volume

2. **mud-slack** (Slack Adapter)
   - Receives Slack events
   - Calls mud-dm API
   - Lightweight, stateless

3. **mud-discord** (Discord Adapter)
   - Receives Discord events
   - Calls mud-dm API
   - Lightweight, stateless

4. **mud-web** (Web Adapter)
   - REST API + WebSocket
   - Calls mud-dm API
   - Session management

5. **mud-world** (World Generation)
   - Tile generation
   - Called by mud-dm

6. **mud-tick** (Worker)
   - Scheduled Cloud Run job
   - Calls mud-dm to advance time

### Service Communication

All services use **internal URLs** for service-to-service calls:

- No public internet egress
- Authenticated with GCP service accounts
- Lower latency

## Client ID Strategy

To ensure uniqueness across platforms:

```typescript
// Format: <platform>:<platform-id>
const clientId = `${clientType}:${platformUserId}`;

// Examples:
// "slack:U01ABC123"
// "discord:123456789012345678"
// "web:session-abc-def-123"
```

This ensures:

- No collisions between platforms
- Easy to identify client source
- Can migrate users between platforms if needed

## Event Flow Example: Player Moves

```
1. Slack user types "/move north"
   ↓
2. Slack adapter receives webhook
   - Validates Slack signature
   - Extracts userId: "U123"
   - Creates clientId: "slack:U123"
   ↓
3. Slack adapter calls DM service:
   mutation { movePlayer(clientId: "slack:U123", direction: NORTH) }
   ↓
4. DM service (@mud/dm):
   - Loads player from DB using clientId
   - Validates move (not in water, etc.)
   - Updates player position
   - Queries monsters at new location
   - Queries other players at location
   - Emits event: EventBus.emit({ eventType: 'player:move', ... })
   ↓
5. Event listeners trigger:
   - AI service generates new tile description (if needed)
   - Notification service alerts nearby players
   ↓
6. DM service returns response
   ↓
7. Slack adapter formats response:
   - Creates Slack blocks
   - Includes player info, nearby entities
   - Sends back to Slack
```

## Benefits of This Architecture

1. **Single World**: All players interact in the same world regardless of client
2. **Scalable**: Each client adapter scales independently
3. **Maintainable**: Client-specific code isolated from game logic
4. **Extensible**: Easy to add new clients (Telegram, CLI, etc.)
5. **Testable**: Game engine can be tested without any client
6. **Flexible**: Can add features to one client without affecting others

## Migration Path from Current Architecture

1. ✅ **Phase 1 Complete**: Create `@mud/engine` library
2. **Phase 2**: Extract client-specific code from `@mud/dm`
3. **Phase 3**: Create thin Slack adapter that calls DM API
4. **Phase 4**: Add Discord adapter
5. **Phase 5**: Add Web adapter

The key insight: **@mud/dm becomes the "Game Engine Service" and adapters become thin I/O translators**.

## Next Steps

To implement this architecture:

1. Update `Player` schema to use `clientId` instead of `slackId`
2. Add `clientType` enum to Player
3. Refactor DM service to be client-agnostic
4. Create REST endpoints (via ts-rest) that use `clientId` instead of `slackId`
5. Update Slack bot to call DM API instead of direct DB access
6. Create Discord adapter skeleton
