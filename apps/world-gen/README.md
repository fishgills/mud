# World Generation Service

A multi-threaded world generation service for creating infinite, deterministic 2D maps using Perlin noise.

## Features

- **Infinite World Generation**: Progressive chunk-based generation (50x50 tiles)
- **Deterministic**: Uses seeds for reproducible world generation
- **Multi-threaded**: Worker threads for chunk generation performance
- **Caching**: Redis for fast tile retrieval
- **Persistence**: MySQL database for permanent storage
- **Biome System**: 18+ different biomes based on height, temperature, and moisture
- **Settlements**: Procedurally generated cities, towns, villages, and farms
- **Map Rendering**: 2D image generation for testing/debugging
- **Statistics**: Performance metrics and world statistics

## Biomes

The world generation creates diverse biomes including:

- Oceans, Lakes, Rivers, Beaches
- Deserts, Grasslands, Forests, Jungles
- Mountains, Hills, Tundra, Taiga
- Swamps, Savanna, Alpine regions
- Volcanic areas

## API Endpoints

### `GET /health`

Health check endpoint

### `GET /chunk/:chunkX/:chunkY`

Retrieve or generate a 50x50 chunk at the specified chunk coordinates.

### `GET /tile/:x/:y`

Get detailed information about a single tile, including nearby biomes.

Response includes:

- Current biome information
- Temperature and moisture levels
- Nearby biomes with distances and directions

### `GET /render?minX=X&maxX=X&minY=Y&maxY=Y`

Generate a 2D PNG image of the specified map region.

### `GET /stats`

Get world generation statistics including:

- Total tiles and chunks generated
- Biome distribution
- Cache hit rates
- Generation performance metrics

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
DATABASE_URL="mysql://username:password@localhost:3306/mud_game"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV=development
```

## Development

```bash
# Build
nx build world-gen

# Run in development
nx serve world-gen

# Run in production
node dist/apps/world-gen/main.js
```

## Architecture

### Noise Generation

- Three noise layers: terrain (height), temperature, moisture
- Configurable octaves, persistence, and lacunarity
- Deterministic using seeds

### Caching Strategy

1. Check Redis cache first
2. If cache miss, check database
3. If database miss, generate new chunk
4. Store results in both cache and database

### Worker Threads

- Configurable worker pool size (default: 4 workers)
- Handles CPU-intensive chunk generation
- Non-blocking chunk processing

### Performance

- Chunk-based generation prevents regenerating existing areas
- Redis caching for sub-second tile retrieval
- Worker threads prevent blocking the main thread
- Database indexing on chunk coordinates and seeds

## Settlement Generation

Settlements are procedurally placed based on:

- Biome suitability (grasslands, rivers, lakes favored)
- Deterministic placement using world seed
- Varied sizes: cities, towns, villages, hamlets, farms
- Realistic population distributions
