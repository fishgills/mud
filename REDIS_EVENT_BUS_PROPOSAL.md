# Redis Event Bus Proposal

## Executive Summary

**Recommendation:** Implement a **hybrid architecture** that keeps GraphQL for request/response operations while adding Redis Pub/Sub for event broadcasting.

## Current Architecture Problems

### 1. **EventBus is DM-Only**

```typescript
// libs/engine/src/events/event-bus.ts
export class EventBus {
  private static listeners: Map<...> = new Map(); // In-memory only!
}
```

- Events (combat, player:move, etc.) trapped in DM service
- Slack bot has no way to know when events occur
- Have to poll or rely on GraphQL response data

### 2. **GraphQL Request/Response Overhead**

```typescript
// Slack bot has to poll or wait for responses
const result = await dmClient.Attack(...);
// Can only send messages to players involved in THIS action
// Other observers miss out unless we query them separately
```

### 3. **Tight Coupling**

- Slack bot must know DM's URL
- DM must generate ALL messages for ALL clients
- Hard to add Discord/Web clients
- Services can't scale independently

## Proposed Hybrid Architecture

### Keep GraphQL For ✅

**Synchronous Request/Response Operations:**

```typescript
// Player actions that need immediate responses
mutation Move { ... }           // Returns: new position, visible tiles
mutation Attack { ... }         // Returns: combat result
query GetPlayer { ... }         // Returns: player state
query GetTileInfo { ... }       // Returns: tile description
```

**Why Keep GraphQL:**

- Type safety with codegen
- Authentication/authorization built-in
- Perfect for operations that need immediate data
- Great developer experience

### Add Redis Pub/Sub For ✅

**Asynchronous Event Broadcasting:**

```typescript
// Redis channels:
'game:combat:*'; // combat:start, combat:hit, combat:end
'game:player:*'; // player:move, player:death, player:levelup
'game:monster:*'; // monster:spawn, monster:death
'game:world:*'; // world:tick, world:weather
'notifications:slack'; // Slack-specific messages
'notifications:discord'; // Future: Discord messages
```

**Why Add Redis Pub/Sub:**

- **Decoupling**: Services don't need to know about each other
- **Scalability**: Multiple bot instances can subscribe
- **Real-time**: Instant notifications
- **Multi-client**: Easy to add Discord, Web clients
- **Resilience**: Services can go down without blocking others

## Implementation Details

### 1. Extend EventBus to Support Redis

```typescript
// libs/redis-client/src/event-bridge.ts
export class RedisEventBridge {
  private redis: Redis;
  private localEventBus: typeof EventBus;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
    this.localEventBus = EventBus;
  }

  /**
   * Bridge local EventBus to Redis Pub/Sub
   */
  async start() {
    // Forward all local events to Redis
    EventBus.onAny((event) => {
      const channel = `game:${event.eventType.replace(':', '.')}`;
      await this.redis.publish(channel, JSON.stringify(event));
    });

    // Subscribe to Redis and emit to local EventBus
    const subscriber = this.redis.duplicate();
    await subscriber.psubscribe('game:*');

    subscriber.on('pmessage', (pattern, channel, message) => {
      const event = JSON.parse(message);
      EventBus.emit(event); // Emit locally
    });
  }
}
```

### 2. DM Service: Publish Events

```typescript
// apps/dm/src/app/app.module.ts
@Module({
  providers: [
    // ... existing providers
    {
      provide: 'REDIS_EVENT_BRIDGE',
      useFactory: (redisClient) => {
        const bridge = new RedisEventBridge(redisClient);
        bridge.start(); // Auto-forward all EventBus events to Redis
        return bridge;
      },
      inject: [RedisClient],
    },
  ],
})
export class AppModule {}
```

**No code changes needed!** EventBus.emit() automatically publishes to Redis.

### 3. Slack Bot: Subscribe to Events

```typescript
// apps/slack-bot/src/services/event-subscriber.ts
export class GameEventSubscriber {
  private redis: Redis;

  async start() {
    await this.redis.psubscribe('game:*', 'notifications:slack');

    this.redis.on('pmessage', async (pattern, channel, message) => {
      const event = JSON.parse(message);

      switch (event.eventType) {
        case 'combat:start':
          // Send notification to players at that location
          break;
        case 'combat:end':
          // Send combat results
          break;
        case 'player:move':
          // Update player location UI
          break;
        // ... handle other events
      }
    });
  }

  async sendCombatNotifications(messages: CombatMessage[]) {
    for (const msg of messages) {
      await this.slackClient.chat.postMessage({
        channel: msg.slackId,
        text: msg.message,
      });
    }
  }
}
```

### 4. New Combat Flow

**Before (GraphQL only):**

```
Player → Slack Bot → GraphQL Attack → DM Service
                                         ↓
                                    Combat logic
                                         ↓
                                Generate ALL messages
                                         ↓
                                    Return result ← Slack Bot
                                         ↓
                              Slack Bot sends messages
```

Problems:

- DM must know about Slack
- Can't add other clients easily
- Observers not notified in real-time

**After (Hybrid):**

```
Player → Slack Bot → GraphQL Attack → DM Service
                                         ↓
                                    Combat logic
                                         ↓
                              EventBus.emit(combat:start)
                              EventBus.emit(combat:hit)
                              EventBus.emit(combat:end)
                                         ↓
                              Redis Pub/Sub broadcast
                                    ↙        ↘
                          Slack Bot      Discord Bot
                              ↓               ↓
                      Send Slack msgs   Send Discord msgs
```

Benefits:

- DM doesn't know about clients
- Easy to add new clients
- Real-time observer notifications
- Services scale independently

## Migration Strategy

### Phase 1: Add Redis Bridge (No Breaking Changes)

1. Implement `RedisEventBridge` in `@mud/redis-client`
2. Add bridge to DM service (auto-publishes events)
3. **No changes to existing code** - just forwards events

### Phase 2: Slack Bot Subscribes

1. Add event subscriber to Slack bot
2. Listen for combat messages
3. Keep existing GraphQL for actions

### Phase 3: Simplify DM Service

1. Remove Slack-specific message generation from DM
2. DM emits generic combat events
3. Slack bot formats messages for Slack
4. Discord bot formats messages for Discord

### Phase 4: Add More Events

1. World service publishes `world:tick` events
2. Population service subscribes to `combat:end` to respawn monsters
3. Analytics service subscribes to all events for metrics

## Benefits Summary

### 🎯 For Your Use Case

**1. Observer Notifications**

- ✅ Combat observers get instant notifications
- ✅ Multiple Slack users notified simultaneously
- ✅ No polling or extra queries needed

**2. Multi-Client Support**

- ✅ Add Discord bot: just subscribe to Redis
- ✅ Add Web client: WebSocket → Redis bridge
- ✅ Each client formats messages for its platform

**3. Service Independence**

- ✅ DM doesn't need to know about Slack
- ✅ Slack bot doesn't need to poll
- ✅ Services can restart without affecting others

**4. Scalability**

- ✅ Run multiple Slack bot instances
- ✅ Redis handles message distribution
- ✅ No single point of failure

**5. Developer Experience**

- ✅ Keep GraphQL type safety for queries
- ✅ Keep EventBus pattern you already have
- ✅ Just add Redis bridge - minimal code changes

## Comparison Table

| Aspect                     | Current (GraphQL Only)  | Proposed (Hybrid)           |
| -------------------------- | ----------------------- | --------------------------- |
| **Request/Response**       | ✅ GraphQL perfect      | ✅ Keep GraphQL             |
| **Event Broadcasting**     | ❌ Not supported        | ✅ Redis Pub/Sub            |
| **Observer Notifications** | ❌ Must poll or query   | ✅ Instant via Redis        |
| **Multi-Client**           | ❌ Hard-coded for Slack | ✅ Easy: subscribe to Redis |
| **Service Coupling**       | ❌ Tight                | ✅ Loose                    |
| **Scalability**            | ❌ Single bot instance  | ✅ Multiple instances       |
| **Type Safety**            | ✅ GraphQL codegen      | ✅ Keep for queries         |
| **Real-time Updates**      | ❌ None                 | ✅ Redis Pub/Sub            |

## Alternative Considered: GraphQL Subscriptions

**Could use GraphQL Subscriptions instead of Redis?**

```graphql
subscription OnCombat {
  combatEvent {
    eventType
    data
  }
}
```

**Why NOT:**

- ❌ More complex (WebSocket infrastructure)
- ❌ Not available in graphql-request (would need Apollo)
- ❌ Harder to scale (WebSocket connections per client)
- ❌ Overkill when Redis is already in your stack
- ❌ Can't easily add non-GraphQL clients

## Recommendation

**Implement the hybrid approach:**

1. ✅ **Keep GraphQL** for all queries and mutations
2. ✅ **Add Redis Pub/Sub** for event broadcasting
3. ✅ **Bridge EventBus** to Redis automatically
4. ✅ **Clients subscribe** to events they care about

This gives you:

- Best of both worlds
- Minimal code changes
- Easy path to multi-client support
- Real-time observer notifications
- Service independence

## Next Steps

1. Implement `RedisEventBridge` in `@mud/redis-client`
2. Add bridge to DM service `AppModule`
3. Add event subscriber to Slack bot
4. Test combat notifications with observers
5. Document event schemas for other clients
6. Consider adding Discord bot as proof of concept

## Code Estimate

**New Files:** 2-3 (bridge, subscriber, types)  
**Modified Files:** 3-4 (app modules, slack bot setup)  
**Lines of Code:** ~300-400  
**Breaking Changes:** 0  
**Time Estimate:** 4-6 hours

The implementation is straightforward because:

- Redis client already exists
- EventBus already exists
- Just need to bridge them
- Existing code continues to work
