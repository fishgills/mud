# World Service Refactoring

## Overview

The original `world.service.ts` was a large, monolithic service handling multiple responsibilities. This refactoring applies DRY (Don't Repeat Yourself) principles and separates concerns into focused, reusable services.

## Original Issues

- **Single Responsibility Violation**: One service handled database operations, chunk generation, tile operations, calculations, and utilities
- **Code Duplication**: Distance calculations, direction calculations, and coordinate transformations were repeated
- **Large File**: 621 lines making it difficult to maintain and test
- **Tight Coupling**: Hard to test individual components in isolation

## Refactored Structure

### 1. WorldDatabaseService (`world-database.service.ts`)

**Responsibility**: All database operations

- Seed management (loading/creating)
- Biome initialization
- Chunk and tile storage/retrieval
- Settlement queries

**Benefits**:

- Centralized database logic
- Easy to mock for testing
- Clear separation of data access

### 2. ChunkGeneratorService (`chunk-generator.service.ts`)

**Responsibility**: Pure chunk generation logic

- Noise generation coordination
- Tile generation
- Settlement placement
- Statistics calculation

**Benefits**:

- Testable without database dependencies
- Pure functions for generation logic
- Isolated chunk creation logic

### 3. TileService (`tile.service.ts`)

**Responsibility**: Tile-specific operations

- Individual tile retrieval
- Nearby biome analysis
- Settlement analysis for tiles
- Chunk reconstruction from cached tiles

**Benefits**:

- Focused tile operations
- Reusable tile analysis logic
- Clear tile-related functionality

### 4. WorldUtilsService (`world-utils.service.ts`)

**Responsibility**: Utility functions and calculations

- Distance calculations
- Direction calculations
- Coordinate transformations
- Settlement overlap checking

**Benefits**:

- **DRY Implementation**: Eliminates code duplication
- Reusable utility functions
- Static utility methods where appropriate
- Consistent calculation logic

### 5. WorldService (`world-refactored.service.ts`)

**Responsibility**: Main orchestration and public API

- Service coordination
- Public API methods
- High-level business logic

**Benefits**:

- Clean, focused interface
- Easy to understand and maintain
- Proper dependency injection

## DRY Improvements

### Before (Original Service)

```typescript
// Distance calculation repeated in multiple places
const distance = Math.sqrt((existingSettlement.x - worldX) ** 2 + (existingSettlement.y - worldY) ** 2);

// Direction calculation duplicated
if (dx > 0 && dy > 0) direction = 'southeast';
else if (dx > 0 && dy < 0) direction = 'northeast';
// ... repeated logic

// Chunk coordinate calculation scattered
const chunkX = Math.floor(x / 50);
const chunkY = Math.floor(y / 50);
```

### After (Refactored Services)

```typescript
// WorldUtilsService - Single source of truth
calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

calculateDirection(fromX: number, fromY: number, toX: number, toY: number): string {
  // Single implementation used everywhere
}

getChunkCoordinates(x: number, y: number): { chunkX: number; chunkY: number } {
  return {
    chunkX: Math.floor(x / WorldUtilsService.CHUNK_SIZE),
    chunkY: Math.floor(y / WorldUtilsService.CHUNK_SIZE),
  };
}
```

## Key Improvements

1. **Reduced Duplication**: Utility functions centralized and reused
2. **Better Testability**: Each service can be tested in isolation
3. **Improved Maintainability**: Clear responsibilities and smaller files
4. **Enhanced Readability**: Each service has a focused purpose
5. **Dependency Injection**: Proper NestJS patterns with clear dependencies
6. **Type Safety**: Maintained strong typing throughout
7. **Error Handling**: Consistent error handling patterns

## File Size Reduction

- **Original**: 621 lines in one file
- **Refactored**: Split into 5 focused files:
  - WorldDatabaseService: ~100 lines
  - ChunkGeneratorService: ~120 lines
  - TileService: ~200 lines
  - WorldUtilsService: ~80 lines
  - WorldService: ~100 lines

## Migration Guide

1. Replace imports of the original `WorldService` with `WorldService` from the refactored module
2. Update module imports to use `WorldRefactoredModule`
3. The public API remains the same, so existing code should work without changes
4. Tests can now be written for individual services

## Usage

```typescript
// In your app module
import { WorldRefactoredModule } from './world/world-refactored.module';

@Module({
  imports: [WorldRefactoredModule],
  // ...
})
export class AppModule {}
```

The refactored services maintain the same external API while providing better internal structure, testability, and maintainability.
