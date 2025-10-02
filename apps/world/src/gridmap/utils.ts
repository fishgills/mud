import { GridConfig, GridConfigLight } from './interfaces';

export const GRID_HEIGHT_CONFIG: GridConfig = {
  width: 250,
  height: 250,
  frequency: 3,
  tilesize: 1,
  gap: 0,
  octaves: 8,
};

export const GRID_MOISTURE_CONFIG: GridConfigLight = {
  frequency: 3,
  octaves: 8,
};

export function buildGridConfigs(): {
  heightConfig: GridConfig;
  moistureConfig: GridConfigLight;
} {
  return {
    heightConfig: GRID_HEIGHT_CONFIG,
    moistureConfig: GRID_MOISTURE_CONFIG,
  };
}

export function deriveTemperature(
  rawHeight: number,
  rawMoisture: number,
  y: number,
): number {
  const latitudeFactor = Math.min(1, Math.abs(y) / 1000);
  const elevationPenalty = (rawHeight + 1) / 2;
  const moistureInfluence = (rawMoisture + 1) / 2;
  const temp =
    1 - elevationPenalty * 0.6 - latitudeFactor * 0.3 + moistureInfluence * 0.1;
  return Math.max(0, Math.min(1, temp));
}
