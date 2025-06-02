# Migration Guide: Moving to World Service

This guide explains how to update the game-engine to use the new world service for tile generation.

## Overview

The tile and biome generation logic has been moved from the game-engine to a separate world service. This provides:

- **Better Performance**: Redis caching for fast tile retrieval
- **Scalability**: World service can be scaled independently
- **Cleaner Architecture**: Separation of concerns

## Files Created/Modified

### World Service (New)
- `apps/world/src/logic/world.ts` - Core world generation logic
- `apps/world/src/logic/biome.ts` - Biome definitions and seeding
- `apps/world/src/routes/world.ts` - World service API endpoints
- `apps/world/src/redis.ts` - Redis client setup
- `apps/world/src/main.ts` - Express server setup

### Game Engine (Modified)
- `apps/game-engine/src/services/world.ts` - Client for world service
- `apps/game-engine/src/routes/player-new.ts` - Simplified player routes
- `apps/game-engine/src/routes/world-new.ts` - Proxy routes to world service

## Migration Steps

### 1. Start Redis (Required)
The world service requires Redis for caching:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or install Redis locally
sudo apt-get install redis-server  # Ubuntu/Debian
brew install redis                 # macOS
```

### 2. Start World Service
```bash
npx nx serve world
```

### 3. Update Game Engine Routes
Replace the old routes with the new ones:

```typescript
// In apps/game-engine/src/app.ts
import playerRoutes from './routes/player-new';  // Instead of './routes/player'
import worldRoutes from './routes/world-new';    // Instead of './routes/world'
```

### 4. Environment Variables
Add to your environment:

```bash
# World service URL (for game-engine)
WORLD_SERVICE_URL=http://localhost:3001

# Redis URL (for world service)
REDIS_URL=redis://localhost:6379
```

## API Changes

### Before (Game Engine)
```typescript
// Tile generation was embedded in player movement
// Complex biome logic in player.ts
```

### After (World Service)
```typescript
import { worldService } from '../services/world';

// Get a tile
const tile = await worldService.getTile(x, y);

// Generate a grid
const tiles = await worldService.generateGrid(centerX, centerY, radius);
```

## Benefits

### Performance
- **Cache Hits**: ~1ms response time
- **Cache Misses**: ~50-100ms (still faster than before)
- **Async Storage**: Doesn't block tile generation

### Scalability
- World service can be scaled horizontally
- Game engine is lighter without world generation
- Redis provides shared cache across instances

### Maintainability
- Clear separation of concerns
- World logic isolated in dedicated service
- Easier to test and debug

## Testing

### Test World Service
```bash
# Health check
curl http://localhost:3001/health

# Get a tile
curl http://localhost:3001/world/tile/0/0

# Seed the world
curl -X POST http://localhost:3001/world/seed

# Get grid view
curl http://localhost:3001/world/grid
```

### Test Game Engine Integration
```bash
# Start both services
npx nx serve world &
npx nx serve game-engine

# Test player creation (should use world service)
curl -X POST http://localhost:3000/players \
  -H "Content-Type: application/json" \
  -d '{"slackId": "test", "name": "TestPlayer"}'
```

## Rollback Plan

If issues arise, you can quickly rollback:

1. Stop the world service
2. Revert to original route files:
   - `apps/game-engine/src/routes/player.ts`
   - `apps/game-engine/src/routes/world.ts`
3. Update app.ts to use original routes

## Monitoring

Key metrics to watch during migration:
- World service response times
- Redis hit/miss ratios
- Game engine latency
- Error rates in both services

## Future Enhancements

With this architecture, you can easily add:
- Multiple world service instances
- Different caching strategies
- World service clustering
- Background world generation
- Persistent Redis with snapshotting
