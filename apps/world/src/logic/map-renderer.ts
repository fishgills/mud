import { createCanvas, CanvasRenderingContext2D } from 'canvas';
import { BiomeRegistry } from './biome-definitions';
import { ChunkWorldGenerator, WorldChunk } from './chunk-generator';
import { DEFAULT_WORLD_CONFIG } from './world-config';
import { WorldTile } from './world';
import prisma from '../prisma';

export interface MapRenderOptions {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  pixelSize: number;
}

export interface CacheStats {
  cacheHits: number;
  databaseHits: number;
  generated: number;
  total: number;
  cacheHitRate: number;
}

/**
 * Get the biome name from a tile (either from cached biome info or database lookup)
 */
async function getBiomeNameFromTile(tile: WorldTile): Promise<string> {
  try {
    const biome = await prisma.biome.findUnique({
      where: { id: tile.biomeId }
    });
    return biome?.name || 'unknown';
  } catch (error) {
    console.warn('Failed to fetch biome name for tile:', error);
    return 'unknown';
  }
}

/**
 * Get required chunks for rendering area (for statistics)
 */
async function getRequiredChunks(
  startX: number, 
  endX: number, 
  startY: number, 
  endY: number, 
  chunkGenerator: ChunkWorldGenerator
): Promise<WorldChunk[]> {
  const chunks: WorldChunk[] = [];
  const startChunkX = ChunkWorldGenerator.worldToChunk(startX, startY).chunkX;
  const endChunkX = ChunkWorldGenerator.worldToChunk(endX, endY).chunkX;
  const startChunkY = ChunkWorldGenerator.worldToChunk(startX, startY).chunkY;
  const endChunkY = ChunkWorldGenerator.worldToChunk(endX, endY).chunkY;
  
  for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
      try {
        const chunk = await chunkGenerator.generateChunk(chunkX, chunkY);
        chunks.push(chunk);
      } catch (error) {
        console.warn(`Failed to load chunk (${chunkX}, ${chunkY}):`, error);
      }
    }
  }
  
  return chunks;
}

export async function renderWorldMap(options: MapRenderOptions): Promise<Buffer> {
  const { centerX, centerY, width, height, pixelSize } = options;
  
  console.log(`🗺️  Starting world map render:`, {
    center: `(${centerX}, ${centerY})`,
    dimensions: `${width}x${height}`,
    pixelSize,
    totalTiles: width * height,
    canvasSize: `${width * pixelSize}x${height * pixelSize}`
  });
  
  const startTime = Date.now();
  
  // Get biome colors from the consolidated registry
  const BIOME_COLORS = BiomeRegistry.getColorMap();
  
  // Calculate world coordinates range
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  
  const startX = centerX - halfWidth;
  const endX = centerX + halfWidth;
  const startY = centerY - halfHeight;
  const endY = centerY + halfHeight;
  
  console.log(`📍 Rendering world coordinates: (${startX}, ${startY}) to (${endX}, ${endY})`);
  
  // Create canvas
  const canvasWidth = width * pixelSize;
  const canvasHeight = height * pixelSize;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  
  console.log(`🎨 Canvas created: ${canvasWidth}x${canvasHeight} pixels`);
  
  // Fill background
  ctx.fillStyle = BIOME_COLORS.ocean;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Initialize chunk generator for efficient tile/chunk management
  const chunkGenerator = new ChunkWorldGenerator(DEFAULT_WORLD_CONFIG);
  console.log(`🌊 Chunk generator initialized with default configuration`);
  
  // Track rendering statistics
  const biomeStats: Record<string, number> = {};
  let tilesProcessed = 0;
  let tilesWithErrors = 0;
  let settlementsFound = 0;
  let chunksUsed = 0;
  
  // Cache hit tracking
  const cacheStats: CacheStats = {
    cacheHits: 0,
    databaseHits: 0,
    generated: 0,
    total: 0,
    cacheHitRate: 0
  };
  
  const totalTiles = width * height;
  
  // Determine which chunks we need to cover the area
  const chunks = await getRequiredChunks(startX, endX, startY, endY, chunkGenerator);
  chunksUsed = chunks.length;
  console.log(`📦 Need ${chunksUsed} chunks to render the area`);
  
  // Generate and render each tile
  for (let worldY = startY; worldY <= endY; worldY++) {
    for (let worldX = startX; worldX <= endX; worldX++) {
      try {
        // Get tile data from cache/database or generate it with tracking
        const tileResult = await chunkGenerator.generateTileWithCacheInfo(worldX, worldY);
        const tile = tileResult.tile;
        
        // Update cache statistics
        cacheStats.total++;
        switch (tileResult.source) {
          case 'cache':
            cacheStats.cacheHits++;
            break;
          case 'database':
            cacheStats.databaseHits++;
            break;
          case 'generated':
            cacheStats.generated++;
            break;
        }
        
        const biomeName = await getBiomeNameFromTile(tile);
        const color = BIOME_COLORS[biomeName] || BIOME_COLORS.unknown;
        
        // Track biome statistics
        biomeStats[biomeName] = (biomeStats[biomeName] || 0) + 1;
        
        // Calculate pixel position (flip Y axis for proper image orientation)
        const pixelX = (worldX - startX) * pixelSize;
        const pixelY = (endY - worldY) * pixelSize;
        
        // Draw pixel block
        ctx.fillStyle = color;
        ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
        
        // Add settlement markers if it's a settlement
        if (BiomeRegistry.isSettlement(biomeName)) {
          settlementsFound++;
          const markerSize = Math.max(1, Math.floor(pixelSize / 4));
          const markerX = pixelX + Math.floor(pixelSize / 2) - Math.floor(markerSize / 2);
          const markerY = pixelY + Math.floor(pixelSize / 2) - Math.floor(markerSize / 2);
          
          ctx.fillStyle = biomeName === 'city' ? '#ffffff' : '#ffff00';
          ctx.fillRect(markerX, markerY, markerSize, markerSize);
        }
        
        tilesProcessed++;
        
      } catch (error) {
        tilesWithErrors++;
        console.warn(`⚠️  Failed to generate tile at (${worldX}, ${worldY}):`, error);
        // Use unknown color for failed tiles
        const pixelX = (worldX - startX) * pixelSize;
        const pixelY = (endY - worldY) * pixelSize;
        ctx.fillStyle = BIOME_COLORS.unknown;
        ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
      }
    }
    
    // Log progress every 10% of rows processed
    const rowsProcessed = worldY - startY + 1;
    const totalRows = height;
    const progressPercent = Math.floor((rowsProcessed / totalRows) * 100);
    if (progressPercent % 10 === 0 && rowsProcessed === Math.floor(totalRows * progressPercent / 100)) {
      console.log(`📊 Rendering progress: ${progressPercent}% (${rowsProcessed}/${totalRows} rows)`);
    }
  }

  const renderTime = Date.now() - startTime;
  
  // Calculate cache hit rate
  cacheStats.cacheHitRate = cacheStats.total > 0 ? 
    Math.round((cacheStats.cacheHits / cacheStats.total) * 100) : 0;
  
  // Convert to buffer
  const bufferStartTime = Date.now();
  const buffer = canvas.toBuffer('image/png');
  const bufferTime = Date.now() - bufferStartTime;
  
  // Log completion statistics
  console.log(`✅ World map render completed:`, {
    renderTime: `${renderTime}ms`,
    bufferTime: `${bufferTime}ms`,
    totalTime: `${renderTime + bufferTime}ms`,
    tilesProcessed,
    tilesWithErrors,
    settlementsFound,
    chunksUsed,
    cacheStats,
    bufferSize: `${Math.round(buffer.length / 1024)}KB`
  });
  
  // Log biome distribution
  console.log(`🌍 Biome distribution:`, 
    Object.entries(biomeStats)
      .sort(([,a], [,b]) => b - a)
      .reduce((acc, [biome, count]) => {
        acc[biome] = `${count} (${Math.round((count / totalTiles) * 100)}%)`;
        return acc;
      }, {} as Record<string, string>)
  );
  
  return buffer;
}

/**
 * Optimized chunk-based rendering for large areas
 */
async function renderChunkBasedMap(options: MapRenderOptions): Promise<Buffer> {
  const { centerX, centerY, width, height, pixelSize } = options;
  
  // Use chunk-based rendering for larger areas (more than 500x500 tiles)
  const useChunkRendering = width * height > 250000;
  
  if (!useChunkRendering) {
    return renderWorldMap(options);
  }
  
  console.log(`🚀 Using optimized chunk-based rendering for large area`);
  
  const startTime = Date.now();
  const BIOME_COLORS = BiomeRegistry.getColorMap();
  
  // Calculate world coordinates range
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  const startX = centerX - halfWidth;
  const endX = centerX + halfWidth;
  const startY = centerY - halfHeight;
  const endY = centerY + halfHeight;
  
  // Create canvas
  const canvasWidth = width * pixelSize;
  const canvasHeight = height * pixelSize;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  
  // Fill background
  ctx.fillStyle = BIOME_COLORS.ocean;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  const chunkGenerator = new ChunkWorldGenerator(DEFAULT_WORLD_CONFIG);
  const biomeStats: Record<string, number> = {};
  let chunksProcessed = 0;
  
  // Cache hit tracking for chunk-based rendering
  const cacheStats: CacheStats = {
    cacheHits: 0,
    databaseHits: 0,
    generated: 0,
    total: 0,
    cacheHitRate: 0
  };
  
  // Determine chunk boundaries
  const startChunkX = ChunkWorldGenerator.worldToChunk(startX, startY).chunkX;
  const endChunkX = ChunkWorldGenerator.worldToChunk(endX, endY).chunkX;
  const startChunkY = ChunkWorldGenerator.worldToChunk(startX, startY).chunkY;
  const endChunkY = ChunkWorldGenerator.worldToChunk(endX, endY).chunkY;
  
  // Process chunks in parallel (limited concurrency)
  const chunkPromises: Promise<void>[] = [];
  const maxConcurrentChunks = 4;
  let activePromises = 0;
  
  for (let chunkX = startChunkX; chunkX <= endChunkX; chunkX++) {
    for (let chunkY = startChunkY; chunkY <= endChunkY; chunkY++) {
      
      while (activePromises >= maxConcurrentChunks) {
        await Promise.race(chunkPromises);
      }
      
      const chunkPromise = processChunk(
        chunkX, chunkY, chunkGenerator, ctx, pixelSize,
        startX, endX, startY, endY, BIOME_COLORS, biomeStats, cacheStats
      ).finally(() => {
        activePromises--;
        chunksProcessed++;
      });
      
      chunkPromises.push(chunkPromise);
      activePromises++;
    }
  }
   // Wait for all chunks to complete
  await Promise.all(chunkPromises);
  
  // Calculate cache hit rate
  cacheStats.cacheHitRate = cacheStats.total > 0 ? 
    Math.round((cacheStats.cacheHits / cacheStats.total) * 100) : 0;

  const renderTime = Date.now() - startTime;
  const buffer = canvas.toBuffer('image/png');

  console.log(`✅ Chunk-based render completed:`, {
    renderTime: `${renderTime}ms`,
    chunksProcessed,
    cacheStats,
    bufferSize: `${Math.round(buffer.length / 1024)}KB`
  });
  
  return buffer;
}

/**
 * Process a single chunk for rendering
 */
async function processChunk(
  chunkX: number,
  chunkY: number,
  chunkGenerator: ChunkWorldGenerator,
  ctx: CanvasRenderingContext2D,
  pixelSize: number,
  startX: number,
  endX: number,
  startY: number,
  endY: number,
  BIOME_COLORS: Record<string, string>,
  biomeStats: Record<string, number>,
  cacheStats: CacheStats
): Promise<void> {
  try {
    const chunkResult = await chunkGenerator.generateChunkWithCacheInfo(chunkX, chunkY);
    const chunk = chunkResult.chunk;
    
    // Count tiles in view area
    const tilesInViewArea = chunk.tiles.filter(tile => 
      tile.x >= startX && tile.x <= endX && tile.y >= startY && tile.y <= endY
    );
    
    // Track chunk cache stats - all tiles in chunk have same cache status
    cacheStats.total += tilesInViewArea.length;
    if (chunkResult.source === 'cache') {
      cacheStats.cacheHits += tilesInViewArea.length;
    } else {
      cacheStats.generated += tilesInViewArea.length;
    }
    
    for (const tile of chunk.tiles) {
      // Only render tiles that are within our view area
      if (tile.x >= startX && tile.x <= endX && tile.y >= startY && tile.y <= endY) {
        const biomeName = await getBiomeNameFromTile(tile);
        const color = BIOME_COLORS[biomeName] || BIOME_COLORS.unknown;
        
        // Track biome statistics
        biomeStats[biomeName] = (biomeStats[biomeName] || 0) + 1;
        
        // Calculate pixel position
        const pixelX = (tile.x - startX) * pixelSize;
        const pixelY = (endY - tile.y) * pixelSize;
        
        // Draw pixel block
        ctx.fillStyle = color;
        ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
        
        // Add settlement markers
        if (BiomeRegistry.isSettlement(biomeName)) {
          const markerSize = Math.max(1, Math.floor(pixelSize / 4));
          const markerX = pixelX + Math.floor(pixelSize / 2) - Math.floor(markerSize / 2);
          const markerY = pixelY + Math.floor(pixelSize / 2) - Math.floor(markerSize / 2);
          
          ctx.fillStyle = biomeName === 'city' ? '#ffffff' : '#ffff00';
          ctx.fillRect(markerX, markerY, markerSize, markerSize);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to process chunk (${chunkX}, ${chunkY}):`, error);
  }
}

// Export the optimized version as the main function
export { renderChunkBasedMap as renderWorldMapOptimized };

export function getBiomeColors(): Record<string, string> {
  return BiomeRegistry.getColorMap();
}
