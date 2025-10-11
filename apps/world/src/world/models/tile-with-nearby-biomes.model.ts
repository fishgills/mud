import type { WorldTile } from './world-tile.model';

export interface NearbyBiome {
  biomeName: string;
  distance: number;
  direction: string;
}

export interface NearbySettlement {
  name: string;
  type: string;
  size: string;
  population: number;
  x: number;
  y: number;
  description: string;
  distance: number;
}

export interface CurrentSettlement {
  name: string;
  type: string;
  size: string;
  intensity: number;
  isCenter: boolean;
}

export interface TileWithNearbyBiomes extends WorldTile {
  nearbyBiomes: NearbyBiome[];
  nearbySettlements: NearbySettlement[];
  currentSettlement?: CurrentSettlement;
}
