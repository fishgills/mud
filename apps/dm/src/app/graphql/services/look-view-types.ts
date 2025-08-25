export interface TimingMetrics {
  tPlayerMs: number;
  tGetCenterMs: number;
  tGetCenterNearbyMs: number;
  tBoundsTilesMs: number;
  tExtBoundsMs: number;
  tFilterTilesMs: number;
  tPeaksSortMs: number;
  tBiomeSummaryMs: number;
  tSettlementsFilterMs: number;
  tAiMs: number;
  tilesCount: number;
  peaksCount: number;
}

export interface VisiblePeak {
  x: number;
  y: number;
  height: number;
  distance: number;
  direction: string;
}

export interface BiomeSummary {
  biomeName: string;
  proportion: number;
  predominantDirections: string[];
}

export interface VisibleSettlement {
  name: string;
  type: string;
  size: string;
  distance: number;
  direction: string;
}

export interface Player {
  x: number;
  y: number;
}

export interface CenterTile {
  x: number;
  y: number;
  biomeName: string;
  description: string;
  height: number;
  temperature: number;
  moisture: number;
}
