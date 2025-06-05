import { parentPort } from 'worker_threads';
import { BiomeRegistry } from './biome-definitions';
import { ChunkWorldGenerator } from './chunk-generator';
import { DEFAULT_WORLD_CONFIG } from './world-config';
import prisma from '../prisma';
import { TileRenderTask, TileRenderResult } from './tile-render-worker-pool';
import { RenderMode } from './map-renderer';

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

/**
 * Convert terrain height (0-1) to a grayscale color
 */
function terrainToColor(height: number): string {
  const intensity = Math.floor(height * 255);
  return `rgb(${intensity}, ${intensity}, ${intensity})`;
}

/**
 * Convert temperature (0-1) to a color gradient from blue (cold) to red (hot)
 */
function temperatureToColor(temperature: number): string {
  // Blue to cyan to green to yellow to red gradient
  if (temperature < 0.25) {
    // Blue to cyan
    const t = temperature * 4;
    const blue = 255;
    const green = Math.floor(t * 255);
    return `rgb(0, ${green}, ${blue})`;
  } else if (temperature < 0.5) {
    // Cyan to green
    const t = (temperature - 0.25) * 4;
    const blue = Math.floor((1 - t) * 255);
    const green = 255;
    return `rgb(0, ${green}, ${blue})`;
  } else if (temperature < 0.75) {
    // Green to yellow
    const t = (temperature - 0.5) * 4;
    const red = Math.floor(t * 255);
    const green = 255;
    return `rgb(${red}, ${green}, 0)`;
  } else {
    // Yellow to red
    const t = (temperature - 0.75) * 4;
    const red = 255;
    const green = Math.floor((1 - t) * 255);
    return `rgb(${red}, ${green}, 0)`;
  }
}

/**
 * Convert moisture (0-1) to a color gradient from brown (dry) to blue (wet)
 */
function moistureToColor(moisture: number): string {
  // Brown to green to blue gradient
  if (moisture < 0.5) {
    // Brown to green
    const t = moisture * 2;
    const red = Math.floor((1 - t) * 139 + t * 0); // Brown (139, 69, 19) to green (0, 128, 0)
    const green = Math.floor((1 - t) * 69 + t * 128);
    const blue = Math.floor((1 - t) * 19 + t * 0);
    return `rgb(${red}, ${green}, ${blue})`;
  } else {
    // Green to blue
    const t = (moisture - 0.5) * 2;
    const red = 0;
    const green = Math.floor((1 - t) * 128 + t * 0);
    const blue = Math.floor((1 - t) * 0 + t * 255);
    return `rgb(${red}, ${green}, ${blue})`;
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

      const { worldX, worldY, startX, endY, pixelSize, renderMode } = task;

      let color: string;
      let biomeName: string;
      let cacheSource: 'cache' | 'database' | 'generated';

      if (renderMode === RenderMode.WORLD) {
        // Original world biome rendering logic
        const tileResult = await chunkGenerator.generateTileWithCacheInfo(
          worldX,
          worldY
        );
        const tile = tileResult.tile;

        biomeName = await getBiomeNameFromTile(tile.biomeId);
        color = biomeColors[biomeName] || biomeColors.unknown || '#000000';
        cacheSource = tileResult.source;
      } else {
        // Generate terrain data for noise map rendering
        const terrain = chunkGenerator
          .getNoiseGenerator()
          .generateTerrain(worldX, worldY);

        switch (renderMode) {
          case RenderMode.TERRAIN:
            color = terrainToColor(terrain.height);
            biomeName = `height:${terrain.height.toFixed(3)}`;
            break;
          case RenderMode.TEMPERATURE:
            color = temperatureToColor(terrain.temperature);
            biomeName = `temp:${terrain.temperature.toFixed(3)}`;
            break;
          case RenderMode.MOISTURE:
            color = moistureToColor(terrain.moisture);
            biomeName = `moisture:${terrain.moisture.toFixed(3)}`;
            break;
          default:
            color = '#000000';
            biomeName = 'unknown';
        }
        cacheSource = 'generated'; // Direct noise generation
      }

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
        cacheSource,
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
