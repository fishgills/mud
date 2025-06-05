import { createCanvas } from 'canvas';
import { BiomeRegistry } from './biome-definitions';
import { ChunkWorldGenerator, WorldChunk } from './chunk-generator';
import { DEFAULT_WORLD_CONFIG } from './world-config';
import {
  TileRenderWorkerPool,
  TileRenderTask,
} from './tile-render-worker-pool';

export enum RenderMode {
  WORLD = 'world',
  TERRAIN = 'terrain',
  TEMPERATURE = 'temperature',
  MOISTURE = 'moisture',
}

export interface MapRenderOptions {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  pixelSize: number;
  renderMode?: RenderMode;
}

export interface CacheStats {
  cacheHits: number;
  databaseHits: number;
  generated: number;
  total: number;
  cacheHitRate: number;
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
  const {
    centerX,
    centerY,
    width,
    height,
    pixelSize,
    renderMode = RenderMode.WORLD,
  } = options;

  console.log(`🗺️  Starting ${renderMode} map render:`, {
    center: `(${centerX}, ${centerY})`,
    dimensions: `${width}x${height}`,
    pixelSize,
    renderMode,
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

  // Fill background based on render mode
  let backgroundColor: string;
  switch (renderMode) {
    case RenderMode.WORLD:
      backgroundColor = BIOME_COLORS.ocean;
      break;
    case RenderMode.TERRAIN:
    case RenderMode.TEMPERATURE:
    case RenderMode.MOISTURE:
      backgroundColor = '#000000'; // Black background for data visualization
      break;
    default:
      backgroundColor = BIOME_COLORS.ocean;
  }
  ctx.fillStyle = backgroundColor;
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

  // Timing stats for tile retrievals
  let totalTileTime = 0;
  let tileCount = 0;

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

  // Initialize worker pool for parallel tile rendering
  const workerPool = new TileRenderWorkerPool({
    maxWorkers: Math.max(2, require('os').availableParallelism() - 2),
  });

  try {
    await workerPool.initialize();

    // Prepare all tile rendering tasks
    const tileStartTime = Date.now();
    const allTasks: TileRenderTask[] = [];

    for (let worldY = startY; worldY <= endY; worldY++) {
      for (let worldX = startX; worldX <= endX; worldX++) {
        allTasks.push({
          worldX,
          worldY,
          startX,
          startY,
          endY,
          pixelSize,
          renderMode,
        });
      }
    }

    console.log(
      `🔄 Processing ${allTasks.length} tiles using ${workerPool['maxWorkers']} worker threads (persistent workers)`
    );

    // Process all tiles concurrently using the worker pool with progress monitoring
    const results = await workerPool.processTasksWithProgress(
      allTasks,
      (completed, total) => {
        const progressPercent = Math.floor((completed / total) * 100);
        if (
          completed % Math.max(1, Math.floor(total / 10)) === 0 ||
          completed === total
        ) {
          console.log(
            `📊 Rendering progress: ${progressPercent}% (${completed}/${total} tiles)`
          );
        }
      }
    );

    // Log final worker pool statistics
    const stats = workerPool.getStats();
    console.log(
      `📊 Worker pool processed ${stats.totalTasksProcessed} tasks total`
    );

    // Apply results to canvas
    for (const result of results) {
      tileCount++;

      // Update cache statistics
      cacheStats.total++;
      switch (result.cacheSource) {
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

      if (result.success) {
        // Track biome statistics
        biomeStats[result.biomeName] = (biomeStats[result.biomeName] || 0) + 1;

        // Draw pixel block
        ctx.fillStyle = result.color;
        ctx.fillRect(result.pixelX, result.pixelY, pixelSize, pixelSize);

        tilesProcessed++;
      } else {
        tilesWithErrors++;
        console.warn(
          `⚠️  Failed to render tile at (${result.worldX}, ${result.worldY}):`,
          result.error
        );

        // Use unknown color for failed tiles
        ctx.fillStyle = BIOME_COLORS.unknown;
        ctx.fillRect(result.pixelX, result.pixelY, pixelSize, pixelSize);
      }
    }

    totalTileTime = Date.now() - tileStartTime;
  } finally {
    // Always cleanup worker pool
    await workerPool.shutdown();
  }

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
  console.log(`✅ ${renderMode} map render completed:`, {
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

  // Log distribution based on render mode
  if (renderMode === RenderMode.WORLD) {
    console.log(
      `🌍 Biome distribution:`,
      Object.entries(biomeStats)
        .sort(([, a], [, b]) => b - a)
        .reduce((acc, [biome, count]) => {
          acc[biome] = `${count} (${Math.round((count / totalTiles) * 100)}%)`;
          return acc;
        }, {} as Record<string, string>)
    );
  } else {
    console.log(
      `📊 Data distribution for ${renderMode}:`,
      Object.entries(biomeStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10) // Show top 10 values for noise data
        .reduce((acc, [value, count]) => {
          acc[value] = `${count} (${Math.round((count / totalTiles) * 100)}%)`;
          return acc;
        }, {} as Record<string, string>)
    );
  }

  return buffer;
}

export function getBiomeColors(): Record<string, string> {
  return BiomeRegistry.getColorMap();
}
