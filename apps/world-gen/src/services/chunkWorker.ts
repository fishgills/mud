// Worker thread for chunk generation
import { parentPort, workerData } from 'worker_threads';
import { getTileNoise, createNoiseLayers } from '../logic/noise';
import { getBiome } from '../logic/biome';

const { chunkX, chunkY, chunkSize, seed } = workerData;
const noiseLayers = createNoiseLayers(seed);

function generateChunk(chunkX: number, chunkY: number, chunkSize: number) {
  const tiles = [];
  for (let dy = 0; dy < chunkSize; dy++) {
    for (let dx = 0; dx < chunkSize; dx++) {
      const x = chunkX * chunkSize + dx;
      const y = chunkY * chunkSize + dy;
      const noise = getTileNoise(x, y, noiseLayers);
      const biome = getBiome(noise);
      tiles.push({
        x,
        y,
        biome,
        temperature: noise.temperature,
        moisture: noise.moisture,
      });
    }
  }
  return tiles;
}

const result = generateChunk(chunkX, chunkY, chunkSize);
parentPort?.postMessage(result);
