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

export interface NearbySettlementDto {
  name: string;
  type: string;
  size: string;
  population: number;
  x: number;
  y: number;
  description: string;
  distance: number;
}

export interface CurrentSettlementDto {
  name: string;
  type: string;
  size: string;
  intensity: number;
  isCenter: boolean;
}

export interface TileWithNearbyDto extends WorldTileDto {
  nearbyBiomes: NearbyBiomeDto[];
  nearbySettlements: NearbySettlementDto[];
  currentSettlement?: CurrentSettlementDto;
}
