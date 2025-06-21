# GraphQL-Friendly World Module Refactor

## Overview

The world module has been refactored to be more GraphQL-friendly by implementing field-level resolution using NestJS `@ResolveField` decorators. This approach improves performance by only fetching data that the client actually requests.

## Architecture Changes

### Before (Monolithic Approach)

- `getChunk(chunkX, chunkY)` returned a complete `ChunkData` object with all tiles, settlements, and stats
- All data was fetched and computed upfront, regardless of what the client needed
- Single large resolver method handling all chunk data

### After (Field-Level Resolution)

- `getChunk(chunkX, chunkY)` returns only basic chunk coordinates (`chunkX`, `chunkY`)
- Individual fields are resolved on-demand using `@ResolveField` decorators:
  - `tiles` - Resolved when requested
  - `settlements` - Resolved when requested
  - `stats` - Resolved when requested
  - `biomeStats` - Resolved when requested

## New Resolver Structure

### ChunkResolver

```typescript
@Resolver(() => ChunkData)
export class ChunkResolver {
  @Query(() => ChunkData)
  async getChunk(@Args('chunkX') chunkX: number, @Args('chunkY') chunkY: number)

  @ResolveField(() => [WorldTile])
  async tiles(@Parent() chunk: ChunkData): Promise<WorldTile[]>

  @ResolveField(() => [Settlement])
  async settlements(@Parent() chunk: ChunkData): Promise<Settlement[]>

  @ResolveField(() => ChunkStats)
  async stats(@Parent() chunk: ChunkData): Promise<ChunkStats>

  @ResolveField(() => [BiomeCount])
  async biomeStats(@Parent() chunk: ChunkData): Promise<BiomeCount[]>
}
```

### WorldTileResolver

```typescript
@Resolver(() => WorldTile)
export class WorldTileResolver {
  @ResolveField(() => Biome)
  async biome(@Parent() tile: WorldTile): Promise<Biome>

  @ResolveField(() => [Monster])
  async monsters(@Parent() tile: WorldTile): Promise<Monster[]>

  @ResolveField(() => [Player])
  async players(@Parent() tile: WorldTile): Promise<Player[]>
}
```

## Tile Operations

### TileResolver

The `TileResolver` provides GraphQL operations for individual tile management, mirroring the REST endpoints in `world.controller.ts`:

```typescript
@Resolver(() => WorldTile)
export class TileResolver {
  @Query(() => TileWithNearbyBiomes)
  async getTile(@Args('x') x: number, @Args('y') y: number)

  @Mutation(() => TileUpdateResult)
  async updateTileDescription(@Args('x') x: number, @Args('y') y: number, @Args('description') description: string)
}
```

### Example Tile Queries

#### Get tile with nearby biomes and settlements:

```graphql
query {
  getTile(x: 25, y: 50) {
    x
    y
    height
    temperature
    moisture
    biomeName
    description
    nearbyBiomes {
      biomeName
      distance
      direction
    }
    nearbySettlements {
      name
      type
      size
      distance
    }
    currentSettlement {
      name
      type
      intensity
      isCenter
    }
  }
}
```

#### Update tile description:

```graphql
mutation {
  updateTileDescription(x: 25, y: 50, description: "A mystical clearing with ancient runes") {
    success
    message
  }
}
```

#### Simple tile info:

```graphql
query {
  getTile(x: 25, y: 50) {
    x
    y
    biomeName
    height
    description
  }
}
```

## Benefits

### Performance Optimization

- **Selective Data Fetching**: Only requested fields are resolved and fetched from the database
- **Reduced Over-fetching**: Client controls exactly what data is retrieved
- **Improved Query Performance**: Database queries are optimized for specific field requests

### Flexibility

- **Granular Queries**: Clients can query just chunk coordinates, or include specific fields as needed
- **Scalable**: Easy to add new fields without affecting existing queries
- **Cacheable**: Individual fields can be cached independently

### Consistency

- **Unified Approach**: Similar patterns for chunk and tile operations
- **Type Safety**: Full TypeScript support across the module

### Example Queries

#### Basic chunk info only:

```graphql
query {
  getChunk(chunkX: 0, chunkY: 0) {
    chunkX
    chunkY
  }
}
```

#### Chunk with tiles only:

```graphql
query {
  getChunk(chunkX: 0, chunkY: 0) {
    chunkX
    chunkY
    tiles {
      x
      y
      height
      biomeName
    }
  }
}
```

#### Chunk with stats and biome distribution:

```graphql
query {
  getChunk(chunkX: 0, chunkY: 0) {
    chunkX
    chunkY
    stats {
      averageHeight
      averageTemperature
      averageMoisture
    }
    biomeStats {
      biomeName
      count
    }
  }
}
```

#### Deep nested query with tile relations:

```graphql
query {
  getChunk(chunkX: 0, chunkY: 0) {
    tiles {
      x
      y
      biome {
        name
      }
      monsters {
        name
        type
        hp
      }
      players {
        name
        level
      }
    }
  }
}
```

## Service Layer Changes

### New Methods in WorldService

- `getChunkTiles(chunkX, chunkY)` - Get tiles for a specific chunk
- `getChunkSettlements(chunkX, chunkY)` - Get settlements in chunk bounds
- `getChunkStats(chunkX, chunkY)` - Calculate chunk statistics
- `getChunkBiomeStats(chunkX, chunkY)` - Calculate biome distribution

### New Methods in WorldDatabaseService

- `getSettlementsInBounds(minX, minY, maxX, maxY)` - Get settlements within bounds
- `getBiomeById(biomeId)` - Get biome by ID
- `getMonstersAtTile(x, y)` - Get monsters at specific coordinates
- `getPlayersAtTile(x, y)` - Get players at specific coordinates

## Model Updates

All GraphQL object types have been updated to make relation fields optional and use `@ResolveField` decorators:

- **ChunkData**: Relations made optional, coordinates required
- **WorldTile**: Biome, monsters, players as resolved fields
- **Biome**: Tiles, monsters as resolved fields
- **Monster**: Biome, worldTile as resolved fields
- **Player**: WorldTile as resolved field

## Migration Guide

### For API Consumers

- Existing queries will continue to work if they specify the required fields
- New queries can be more selective about what data they need
- Performance will improve for queries that don't need all chunk data

### For Developers

- Use the new service methods for field-specific data retrieval
- Add new `@ResolveField` methods for additional relations
- Consider caching strategies for frequently accessed resolved fields

## Future Enhancements

1. **Caching**: Implement field-level caching for resolved fields
2. **Pagination**: Add pagination support for large collections (tiles, monsters, etc.)
3. **DataLoader**: Implement DataLoader pattern to batch database queries
4. **Subscriptions**: Add real-time subscriptions for chunk updates
