export interface GridPoint {
  x: number;
  y: number;
}

export interface GridBiome {
  coordinates: [GridPoint, GridPoint];
  color: string;
  name: string;
  id: number;
}

export interface GridConfig {
  width: number;
  height: number;
  frequency: number;
  tilesize: number;
  gap: number;
  octaves: number;
}

export type GridConfigLight = Pick<GridConfig, 'frequency' | 'octaves'>;

export interface GridTileSample {
  rawHeight: number;
  rawMoisture: number;
  height: number;
  moisture: number;
  biome: GridBiome;
}
