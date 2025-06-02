# World Service

The World Service is a separate microservice responsible for generating and caching world tiles for the MUD game. It provides fast tile generation using Redis for caching and MySQL with Prisma for persistent storage.

## Architecture

- **Fast Generation**: Tiles are generated on-demand using sophisticated biome algorithms
- **Redis Caching**: Generated tiles are cached in Redis for quick retrieval (1 hour TTL)
- **Async Storage**: Tiles are stored in MySQL asynchronously to avoid blocking generation
- **Microservice**: Separate from the game-engine, can be scaled independently

## Features

- **Biome Generation**: Intelligent biome placement with size limits and neighbor rules
- **Spatial Constraints**: Cities and villages have minimum distance requirements
- **Biome Mixing**: Each tile has a biome mix based on surrounding tiles
- **Grid Generation**: Can generate entire grids of tiles at once
- **Seeding**: Initial world seeding with starter town

## API Endpoints

### GET /world/tile/:x/:y
Get or generate a single tile at coordinates (x, y).

**Response:**
```json
{
  "id": 1,
  "x": 5,
  "y": 3,
  "biomeId": 2,
  "description": "You are in a forest at (5, 3).",
  "biomeMix": {
    "forest": 0.6,
    "plains": 0.4
  }
}
```

### POST /world/grid
Generate a grid of tiles around a center point.

**Request:**
```json
{
  "centerX": 0,
  "centerY": 0,
  "radius": 5
}
```

**Response:**
```json
{
  "tiles": [...],
  "count": 121
}
```

### GET /world/grid
Get a text representation of the world grid.

**Query Parameters:**
- `size`: Grid size (default: 11)
- `centerX`: Center X coordinate (default: 0)
- `centerY`: Center Y coordinate (default: 0)

**Response:** Plain text grid representation

### POST /world/seed
Seed the world with initial biomes and starter town.

### DELETE /world/reset
Reset the world by deleting all tiles.

## Environment Variables

- `DATABASE_URL`: MySQL connection string
- `REDIS_URL`: Redis connection URL (default: redis://localhost:6379)
- `HOST`: Service host (default: localhost)
- `PORT`: Service port (default: 3001)

## Configuration

### Biome Size Limits
```typescript
export const BIOME_SIZE_LIMITS: Record<string, number> = {
  city: 5,
  village: 8,
  forest: 25,
  desert: 30,
  plains: 40,
  mountains: 20,
  hills: 15,
};
```

### Distance Constraints
- Cities: Minimum 10 tiles apart
- Villages: Minimum 6 tiles apart

### Biome Neighbors
Each biome has rules about which biomes can be adjacent:
- Cities can border: city, village, plains
- Villages can border: village, plains, forest
- And so on...

## Integration with Game Engine

The game engine uses a `WorldServiceClient` to communicate with the world service:

```typescript
import { worldService } from '../services/world';

// Get a tile
const tile = await worldService.getTile(x, y);

// Generate a grid
const tiles = await worldService.generateGrid(centerX, centerY, radius);
```

## Running the Service

```bash
# Development
npx nx serve world

# Production build
npx nx build world
```

## Performance

- **Cache Hit**: ~1ms (Redis lookup)
- **Cache Miss + Generation**: ~50-100ms (depends on biome complexity)
- **Database Storage**: Async, doesn't block generation
- **Grid Generation**: Parallelized for better performance

## Scaling

The service can be scaled horizontally:
- Multiple instances can share the same Redis cache
- Database writes are async so they don't create bottlenecks
- Stateless design allows for load balancing

## Monitoring

Key metrics to monitor:
- Cache hit ratio
- Average generation time
- Database write lag
- Redis memory usage
- Error rates for tile generation
