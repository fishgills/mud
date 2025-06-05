import { Biome } from '../logic/biome';
import { TileInfo } from '../services/chunkService';

// Find nearby biomes and their distances from a given tile
export function findNearbyBiomes(
  tiles: TileInfo[],
  center: TileInfo,
  radius = 5
): { biome: Biome; distance: number }[] {
  const result: { biome: Biome; distance: number }[] = [];
  const seen = new Set<Biome>();
  for (const tile of tiles) {
    if (tile.x === center.x && tile.y === center.y) continue;
    const dist = Math.sqrt((tile.x - center.x) ** 2 + (tile.y - center.y) ** 2);
    if (dist <= radius && !seen.has(tile.biome)) {
      result.push({ biome: tile.biome, distance: dist });
      seen.add(tile.biome);
    }
  }
  return result;
}
