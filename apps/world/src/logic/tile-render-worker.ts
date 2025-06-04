import { parentPort } from 'worker_threads';
import { BiomeRegistry } from './biome-definitions';
import { ChunkWorldGenerator } from './chunk-generator';
import { DEFAULT_WORLD_CONFIG } from './world-config';
import prisma from '../prisma';
import { TileRenderTask, TileRenderResult } from './tile-render-worker-pool';

/**
 * Get the biome name from a tile (either from cached biome info or database lookup)
 */
async function getBiomeNameFromTile(biomeId: number): Promise<string> {
  try {
    const biome = await prisma.biome.findUnique({
      where: { id: biomeId },
    });
    return biome?.name || 'unknown';
  } catch (error) {
    console.warn('Failed to fetch biome name for biome ID:', biomeId, error);
    return 'unknown';
  }
}

// Initialize worker
let chunkGenerator: ChunkWorldGenerator | null = null;
let biomeColors: Record<string, string> | null = null;

async function initializeWorker(): Promise<void> {
  try {
    chunkGenerator = new ChunkWorldGenerator(DEFAULT_WORLD_CONFIG);
    biomeColors = BiomeRegistry.getColorMap();
    console.log('Worker initialized successfully');
  } catch (error) {
    console.error('Failed to initialize worker:', error);
    throw error;
  }
}

// Initialize when worker starts
initializeWorker().catch((error) => {
  console.error('Worker initialization failed:', error);
  process.exit(1);
});

// Handle incoming messages
if (parentPort) {
  parentPort.on('message', async (task: TileRenderTask) => {
    try {
      if (!chunkGenerator || !biomeColors) {
        throw new Error('Worker not properly initialized');
      }

      const { worldX, worldY, startX, endY, pixelSize } = task;

      // Generate tile with cache info
      const tileResult = await chunkGenerator.generateTileWithCacheInfo(
        worldX,
        worldY
      );
      const tile = tileResult.tile;

      // Get biome name
      const biomeName = await getBiomeNameFromTile(tile.biomeId);
      const color = biomeColors[biomeName] || biomeColors.unknown || '#000000';

      // Calculate pixel position (flip Y axis for proper image orientation)
      const pixelX = (worldX - startX) * pixelSize;
      const pixelY = (endY - worldY) * pixelSize;

      const result: TileRenderResult = {
        worldX,
        worldY,
        pixelX,
        pixelY,
        color,
        biomeName,
        cacheSource: tileResult.source,
        success: true,
      };

      parentPort?.postMessage(result);
    } catch (error) {
      const result: TileRenderResult = {
        worldX: task.worldX,
        worldY: task.worldY,
        pixelX: (task.worldX - task.startX) * task.pixelSize,
        pixelY: (task.endY - task.worldY) * task.pixelSize,
        color: '#000000', // Default error color
        biomeName: 'unknown',
        cacheSource: 'generated',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      parentPort?.postMessage(result);
    }
  });
} else {
  console.error('No parent port available in worker');
  process.exit(1);
}
