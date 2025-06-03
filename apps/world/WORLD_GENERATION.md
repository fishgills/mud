# Noise-Based World Generation System

This document describes the new deterministic, chunk-based world generation system for the MUD game. The system uses Perlin noise to create realistic terrain with multiple biomes based on height, temperature, and moisture maps.

## Features

### ✨ Key Features

- **Deterministic Generation**: Same coordinates always produce the same terrain using seed-based noise
- **Chunk-Based**: World is generated in 20x20 chunks for efficient loading
- **Multi-Layer Noise**: Uses separate noise maps for height, temperature, and moisture
- **Rich Biome System**: 15+ different biomes based on terrain combinations
- **Configurable**: Easy to tweak generation parameters and add new biomes
- **Settlement Placement**: Intelligent city and village placement with spacing constraints

### 🏔️ Available Biomes

The system includes these biomes, determined by combinations of height, temperature, and moisture:

| Biome | Height | Temperature | Moisture | Description |
|-------|--------|-------------|----------|-------------|
| Ocean | Very Low | Any | Any | Deep ocean waters |
| Lake | Low | Any | High | Freshwater lakes |
| Beach | Low | Medium-High | Low-Medium | Sandy coastal areas |
| Tundra | Medium | Very Low | Low-Medium | Frozen tundra |
| Taiga | Medium | Low | Medium-High | Northern coniferous forest |
| Mountains | Very High | Low-Medium | Any | Rocky mountain peaks |
| Hills | High | Medium | Any | Rolling hills |
| Desert | Medium | Very High | Very Low | Arid desert |
| Savanna | Medium | High | Low-Medium | Grassland with scattered trees |
| Plains | Medium | Medium | Medium | Open grasslands |
| Forest | Medium | Medium | Medium-High | Temperate deciduous forest |
| Jungle | Medium | Very High | Very High | Dense tropical jungle |
| Rainforest | Medium | High | Very High | Lush tropical rainforest |
| Swamp | Low-Medium | Medium-High | Very High | Wetland marshes |
| Village | Medium | Medium | Medium | Small settlements (rare) |
| City | Medium | Medium | Medium | Large settlements (very rare) |

## Architecture

### 📁 File Structure

```
apps/world/src/logic/
├── noise-generator.ts     # Core Perlin noise generation
├── biome-mapper.ts        # Biome determination logic
├── chunk-generator.ts     # Chunk-based world generation
├── world-config.ts        # Configuration presets
├── world.ts              # Main world interface (updated)
└── biome.ts              # Biome database seeding
```

### 🔧 Core Components

#### NoiseGenerator
- Generates deterministic Perlin noise with multiple octaves
- Separate noise maps for height, temperature, and moisture
- Configurable parameters (scale, octaves, persistence, lacunarity)

#### BiomeMapper
- Maps terrain data (height/temperature/moisture) to biomes
- Uses rule-based system with priority scoring
- Calculates biome mix for transitions between different areas

#### ChunkWorldGenerator
- Generates world in 20x20 tile chunks
- Caches generated chunks in Redis
- Handles settlement placement with spacing constraints
- Stores generated tiles in database asynchronously

## Usage

### 🚀 Basic Usage

```typescript
// Generate a single tile
const tile = await generateTile(x, y);

// Generate an entire chunk
const chunk = await generateChunk(chunkX, chunkY);

// Generate a grid around a point
const tiles = await generateTileGrid(centerX, centerY, radius);
```

### 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tile/:x/:y` | GET | Generate/get a single tile |
| `/chunk/:chunkX/:chunkY` | GET | Generate/get a complete chunk |
| `/chunk-info/:x/:y` | GET | Get chunk information for coordinates |
| `/grid` | POST | Generate a grid of tiles |

### 📡 Example API Calls

```bash
# Get a single tile
curl http://localhost:3000/tile/10/20

# Get a chunk (contains 400 tiles)
curl http://localhost:3000/chunk/0/0

# Get chunk info for world coordinates
curl http://localhost:3000/chunk-info/50/75

# Generate a 5x5 grid around point (0,0)
curl -X POST http://localhost:3000/grid \
  -H "Content-Type: application/json" \
  -d '{"centerX": 0, "centerY": 0, "radius": 2}'
```

## Configuration

### ⚙️ World Parameters

The system supports different world configurations in `world-config.ts`:

```typescript
// Default balanced world
const config = DEFAULT_WORLD_CONFIG;

// Mountainous world with more elevation
const config = MOUNTAINOUS_WORLD_CONFIG;

// Island world with more water
const config = ISLAND_WORLD_CONFIG;
```

### 🎛️ Noise Parameters

Each noise layer can be configured:

```typescript
{
  seed: 12345,           // Deterministic seed
  scale: 0.01,          // Feature size (smaller = larger features)
  octaves: 6,           // Detail levels (more = more detail)
  persistence: 0.5,     // Amplitude reduction per octave
  lacunarity: 2.0       // Frequency increase per octave
}
```

### 🏘️ Settlement Settings

Control settlement generation:

```typescript
{
  settlementSpacing: 50,    // Minimum distance between settlements
  cityProbability: 0.002,   // 0.2% chance per suitable tile
  villageProbability: 0.01  // 1% chance per suitable tile
}
```

## Adding New Biomes

### 📝 Step 1: Define Biome Rule

Add to `biome-mapper.ts`:

```typescript
{
  name: 'volcanic',
  heightRange: [0.7, 1.0],      // High elevation
  temperatureRange: [0.8, 1.0], // Very hot
  moistureRange: [0.0, 0.3],    // Dry
  priority: 8,                   // High priority
  description: 'Active volcanic region with lava flows.'
}
```

### 📝 Step 2: Add to Database Seeds

Add to `biome.ts`:

```typescript
{ name: 'volcanic', description: 'Active volcanic region with lava flows.' }
```

### 📝 Step 3: Update Display

Add to route mapping in `routes/world.ts`:

```typescript
volcanic: 'v'  // Letter for text display
```

## Performance

### 🚀 Optimization Features

- **Chunk Caching**: Generated chunks cached in Redis for 2 hours
- **Tile Caching**: Individual tiles cached for 1 hour
- **Async Storage**: Database writes happen asynchronously
- **Lazy Generation**: Only generates content when requested

### 📊 Performance Characteristics

- Single tile generation: ~1-5ms
- Chunk generation (400 tiles): ~50-200ms
- Cache hit: ~1ms
- Database lookup: ~10-50ms

## Migration

### 🔄 Backward Compatibility

The system maintains compatibility with existing code:

- `generateTile(x, y)` still works
- `generateTileGrid()` still works
- Existing database tiles are preserved
- Old biomes continue to work

### 🗄️ Database

No database migration required. New biomes will be created automatically when first encountered.

## Testing

### 🧪 Test Script

Run the test script to verify generation:

```bash
cd apps/world
npx ts-node test-world-generation.ts
```

### 🔍 Visual Testing

Use the grid endpoint to visualize generated terrain:

```bash
curl http://localhost:3000/grid?size=21&centerX=0&centerY=0
```

This returns a text map like:
```
O O O L L F F M M M M M M F F L L O O O O
O O L L F F F F M M M M F F F F L L O O O
L L F F F P P H H M M H H P P F F F L L L
```

## Future Enhancements

### 🔮 Planned Features

- **Climate Zones**: Large-scale climate patterns
- **Rivers**: Flowing water systems connecting lakes to oceans
- **Roads**: Generated paths between settlements
- **Elevation Rendering**: Visual height maps
- **Weather Systems**: Dynamic weather based on terrain
- **Resource Distribution**: Mineral and resource placement
- **Biome Transitions**: Smoother borders between biomes

### 🛠️ Technical Improvements

- **Faster Noise**: GPU-accelerated noise generation
- **Streaming**: Real-time chunk generation for large worlds
- **Compression**: Compressed chunk storage
- **Distributed**: Multi-server world generation
