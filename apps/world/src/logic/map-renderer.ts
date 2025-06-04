import { createCanvas } from 'canvas';
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
      where: { id: tile.biomeId },
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

export async function renderWorldMap(
  options: MapRenderOptions
): Promise<Buffer> {
  const { centerX, centerY, width, height, pixelSize } = options;

  console.log(`🗺️  Starting world map render:`, {
    center: `(${centerX}, ${centerY})`,
    dimensions: `${width}x${height}`,
    pixelSize,
    totalTiles: width * height,
    canvasSize: `${width * pixelSize}x${height * pixelSize}`,
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

  console.log(
    `📍 Rendering world coordinates: (${startX}, ${startY}) to (${endX}, ${endY})`
  );

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
  let chunksUsed = 0;

  // Cache hit tracking
  const cacheStats: CacheStats = {
    cacheHits: 0,
    databaseHits: 0,
    generated: 0,
    total: 0,
    cacheHitRate: 0,
  };

  const totalTiles = width * height;

  // Determine which chunks we need to cover the area
  const chunks = await getRequiredChunks(
    startX,
    endX,
    startY,
    endY,
    chunkGenerator
  );
  chunksUsed = chunks.length;
  console.log(`📦 Need ${chunksUsed} chunks to render the area`);

  // Timing stats for tile retrievals
  let totalTileTime = 0;
  let tileCount = 0;

  // Generate and render each tile asynchronously by row
  const tileStartTime = Date.now();
  for (let worldY = startY; worldY <= endY; worldY++) {
    const rowPromises: Promise<void>[] = [];
    for (let worldX = startX; worldX <= endX; worldX++) {
      rowPromises.push(
        (async () => {
          try {
            const tileResult = await chunkGenerator.generateTileWithCacheInfo(
              worldX,
              worldY
            );
            tileCount++;
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

            // (Settlement marker logic removed)

            tilesProcessed++;
          } catch (error) {
            tilesWithErrors++;
            console.warn(
              `⚠️  Failed to generate tile at (${worldX}, ${worldY}):`,
              error
            );
            // Use unknown color for failed tiles
            const pixelX = (worldX - startX) * pixelSize;
            const pixelY = (endY - worldY) * pixelSize;
            ctx.fillStyle = BIOME_COLORS.unknown;
            ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
          }
        })()
      );
    }
    await Promise.all(rowPromises);

    // Log progress every 10% of rows processed
    const rowsProcessed = worldY - startY + 1;
    const totalRows = height;
    const progressPercent = Math.floor((rowsProcessed / totalRows) * 100);
    if (
      progressPercent % 10 === 0 &&
      rowsProcessed === Math.floor((totalRows * progressPercent) / 100)
    ) {
      console.log(
        `📊 Rendering progress: ${progressPercent}% (${rowsProcessed}/${totalRows} rows)`
      );
    }
  }
  totalTileTime = Date.now() - tileStartTime;

  const renderTime = Date.now() - startTime;

  // Calculate cache hit rate
  cacheStats.cacheHitRate =
    cacheStats.total > 0
      ? Math.round((cacheStats.cacheHits / cacheStats.total) * 100)
      : 0;

  // Convert to buffer
  const bufferStartTime = Date.now();
  const buffer = canvas.toBuffer('image/png');
  const bufferTime = Date.now() - bufferStartTime;

  // Log completion statistics
  const avgTileTime =
    tileCount > 0 ? (totalTileTime / tileCount).toFixed(2) : '0';
  console.log(`✅ World map render completed:`, {
    renderTime: `${renderTime}ms`,
    bufferTime: `${bufferTime}ms`,
    totalTime: `${renderTime + bufferTime}ms`,
    tilesProcessed,
    tilesWithErrors,
    chunksUsed,
    cacheStats,
    bufferSize: `${Math.round(buffer.length / 1024)}KB`,
    tileTiming: {
      totalTileTime: `${totalTileTime}ms`,
      tileCount,
      avgTileTime: `${avgTileTime}ms`,
    },
  });

  // Log biome distribution
  console.log(
    `🌍 Biome distribution:`,
    Object.entries(biomeStats)
      .sort(([, a], [, b]) => b - a)
      .reduce((acc, [biome, count]) => {
        acc[biome] = `${count} (${Math.round((count / totalTiles) * 100)}%)`;
        return acc;
      }, {} as Record<string, string>)
  );

  return buffer;
}

export function getBiomeColors(): Record<string, string> {
  return BiomeRegistry.getColorMap();
}
