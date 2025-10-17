export interface WorldSeed {
  id: number;
  seed: number;
  heightSeed: number;
  temperatureSeed: number;
  moistureSeed: number;
  heightScale: number;
  temperatureScale: number;
  moistureScale: number;
  heightOctaves: number;
  temperatureOctaves: number;
  moistureOctaves: number;
  heightPersistence: number;
  temperaturePersistence: number;
  moisturePersistence: number;
  heightLacunarity: number;
  temperatureLacunarity: number;
  moistureLacunarity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
