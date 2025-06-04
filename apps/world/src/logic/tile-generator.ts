import { NoiseGenerator } from './noise-generator';
import { DRYTileUtils } from './tile-utils';
import { WorldTile } from './world';

export class TileGenerator {
  private noiseGenerator: NoiseGenerator;

  constructor(worldParameters: import('./noise-generator').WorldParameters) {
    this.noiseGenerator = new NoiseGenerator(worldParameters);
  }

  async generateTile(x: number, y: number): Promise<WorldTile> {
    const terrain = this.noiseGenerator.generateTerrain(x, y);
    const biomeName = DRYTileUtils.determineBiome(terrain);
    return DRYTileUtils.createTileFromBiome(x, y, biomeName);
  }

  async getTileFromCache(x: number, y: number): Promise<WorldTile | null> {
    return DRYTileUtils.getTileFromCache(x, y);
  }

  async cacheTile(tile: WorldTile): Promise<void> {
    return DRYTileUtils.cacheTile(tile);
  }

  async findExistingTile(x: number, y: number): Promise<WorldTile | null> {
    return DRYTileUtils.findExistingTile(x, y);
  }
}
