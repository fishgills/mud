import { parentPort } from 'worker_threads';
import {
  NoiseGenerator,
  DEFAULT_WORLD_CONFIG,
  WorldSeedConfig,
} from '../utils/noise';
import { BiomeGenerator, TileData } from '../utils/biome';
import { SettlementGenerator } from '../utils/settlement';

interface ChunkData {
  tiles: TileData[];
  settlements: Array<{
    name: string;
    type: string;
    size: string;
    population: number;
    x: number;
    y: number;
    description: string;
  }>;
  stats: {
    biomes: Record<string, number>;
    averageHeight: number;
    averageTemperature: number;
    averageMoisture: number;
  };
}

/**
 * Get minimum distance between settlements based on size
 */
function getMinDistanceBetweenSettlements(size: string): number {
  switch (size) {
    case 'large':
      return 20; // Cities need lots of space
    case 'medium':
      return 15; // Towns need moderate space
    case 'small':
      return 10; // Villages need some space
    case 'tiny':
      return 8; // Hamlets/farms need minimal space
    default:
      return 8;
  }
}

if (parentPort) {
  parentPort.on('message', (task) => {
    try {
      if (task.type === 'generateChunk') {
        const result = generateChunk(
          task.data.chunkX,
          task.data.chunkY,
          task.data.seed
        );
        parentPort?.postMessage({
          taskId: task.id,
          success: true,
          data: result,
        });
      } else {
        parentPort?.postMessage({
          taskId: task.id,
          success: false,
          error: `Unknown task type: ${task.type}`,
        });
      }
    } catch (error) {
      parentPort?.postMessage({
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

function generateChunk(
  chunkX: number,
  chunkY: number,
  seed: number
): ChunkData {
  const config: WorldSeedConfig = {
    heightSeed: seed,
    temperatureSeed: seed + 1000,
    moistureSeed: seed + 2000,
    ...DEFAULT_WORLD_CONFIG,
  };

  const noiseGenerator = new NoiseGenerator(config);
  const settlementGenerator = new SettlementGenerator(seed);

  const tiles: TileData[] = [];
  const settlements: ChunkData['settlements'] = [];
  const biomeCount: Record<string, number> = {};

  let totalHeight = 0;
  let totalTemperature = 0;
  let totalMoisture = 0;

  // Generate 50x50 tiles for this chunk
  const CHUNK_SIZE = 50;
  const startX = chunkX * CHUNK_SIZE;
  const startY = chunkY * CHUNK_SIZE;

  for (let localX = 0; localX < CHUNK_SIZE; localX++) {
    for (let localY = 0; localY < CHUNK_SIZE; localY++) {
      const worldX = startX + localX;
      const worldY = startY + localY;

      const height = noiseGenerator.generateHeight(worldX, worldY);
      const temperature = noiseGenerator.generateTemperature(worldX, worldY);
      const moisture = noiseGenerator.generateMoisture(worldX, worldY);

      const biome = BiomeGenerator.determineBiome(
        height,
        temperature,
        moisture
      );

      tiles.push({
        x: worldX,
        y: worldY,
        height,
        temperature,
        moisture,
        biome,
      });

      // Update statistics
      biomeCount[biome.name] = (biomeCount[biome.name] || 0) + 1;
      totalHeight += height;
      totalTemperature += temperature;
      totalMoisture += moisture;

      // Check for settlement generation
      if (settlementGenerator.shouldGenerateSettlement(worldX, worldY, biome)) {
        // Ensure no overlap with existing settlements
        const hasOverlap = settlements.some((existingSettlement) => {
          const distance = Math.sqrt(
            (existingSettlement.x - worldX) ** 2 +
              (existingSettlement.y - worldY) ** 2
          );
          // Prevent settlements from being too close - use a simple distance check
          // Large settlements need more space around them
          const minDistance = getMinDistanceBetweenSettlements(
            existingSettlement.size
          );
          return distance < minDistance;
        });

        if (!hasOverlap) {
          const settlement = settlementGenerator.generateSettlement(
            worldX,
            worldY,
            biome
          );
          settlements.push(settlement);
        }
      }
    }
  }

  const totalTiles = CHUNK_SIZE * CHUNK_SIZE;

  return {
    tiles,
    settlements,
    stats: {
      biomes: biomeCount,
      averageHeight: totalHeight / totalTiles,
      averageTemperature: totalTemperature / totalTiles,
      averageMoisture: totalMoisture / totalTiles,
    },
  };
}
