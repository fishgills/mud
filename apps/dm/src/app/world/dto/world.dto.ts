export interface WorldTileDto {
  id: number;
  x: number;
  y: number;
  biomeId: number;
  biomeName: string;
  description?: string | null;
  height: number;
  temperature: number;
  moisture: number;
  seed: number;
  chunkX: number;
  chunkY: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface NearbyBiomeDto {
  biomeName: string;
  distance: number;
  direction: string;
}

export interface TileWithNearbyDto extends WorldTileDto {
  nearbyBiomes: NearbyBiomeDto[];
}
