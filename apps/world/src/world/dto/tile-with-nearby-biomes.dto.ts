import type { WorldTile } from './world-tile.dto';

export interface NearbyBiome {
  biomeName: string;
  distance: number;
  direction: string;
}

export interface TileWithNearbyBiomes extends WorldTile {
  nearbyBiomes: NearbyBiome[];
}
