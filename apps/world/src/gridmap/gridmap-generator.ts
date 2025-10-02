import { createNoise2D } from 'simplex-noise';
import seedrandom from 'seedrandom';
import {
  GridBiome,
  GridConfig,
  GridConfigLight,
  GridTileSample,
} from './interfaces';
import { DEFAULT_BIOMES } from './default-biomes';

export class GridMapGenerator {
  private biomes: GridBiome[];
  private heightMapConfig: GridConfig;
  private moistureMapConfig: GridConfigLight;
  private heightNoise: (x: number, y: number) => number;
  private moistureNoise: (x: number, y: number) => number;

  constructor(
    heightMapConfig: GridConfig,
    moistureMapConfig: GridConfigLight,
    biomes: GridBiome[] = DEFAULT_BIOMES,
    seed = 0,
  ) {
    this.heightMapConfig = heightMapConfig;
    this.moistureMapConfig = moistureMapConfig;
    this.biomes = biomes;

    const heightRng = seedrandom(`${seed}:height`);
    const moistureRng = seedrandom(`${seed}:moisture`);
    this.heightNoise = createNoise2D(() => heightRng());
    this.moistureNoise = createNoise2D(() => moistureRng());
  }

  sampleTile(x: number, y: number): GridTileSample {
    const rawHeight = this.sampleHeight(x, y);
    const rawMoisture = this.sampleMoisture(x, y);
    const biome = this.chooseBiome(rawHeight, rawMoisture);

    return {
      rawHeight,
      rawMoisture,
      height: this.normalize(rawHeight),
      moisture: this.normalize(rawMoisture),
      biome,
    };
  }

  private sampleHeight(x: number, y: number): number {
    const wavelengthX =
      this.heightMapConfig.width / this.heightMapConfig.frequency;
    const wavelengthY =
      this.heightMapConfig.height / this.heightMapConfig.frequency;

    const nx = x / wavelengthX;
    const ny = y / wavelengthY;

    let e = 0;
    let acc = 0;
    for (let o = 0; o < this.heightMapConfig.octaves; o++) {
      const pow = 2 ** o;
      acc += 1 / pow;
      e += this.heightNoise(pow * nx, pow * ny) / pow;
    }

    return e / acc;
  }

  private sampleMoisture(x: number, y: number): number {
    const wavelengthX =
      this.heightMapConfig.width / this.moistureMapConfig.frequency;
    const wavelengthY =
      this.heightMapConfig.height / this.moistureMapConfig.frequency;

    const nx = x / wavelengthX;
    const ny = y / wavelengthY;

    let e = 0;
    let acc = 0;
    for (let o = 0; o < this.moistureMapConfig.octaves; o++) {
      const pow = 2 ** o;
      acc += 1 / pow;
      e += this.moistureNoise(pow * nx, pow * ny) / pow;
    }

    return e / acc;
  }

  private chooseBiome(height: number, moisture: number): GridBiome {
    const matching = this.biomes.filter((biome) => {
      return (
        height >= biome.coordinates[0].x &&
        height <= biome.coordinates[1].x &&
        moisture >= biome.coordinates[0].y &&
        moisture <= biome.coordinates[1].y
      );
    });

    return matching.at(-1) ?? this.biomes[0];
  }

  private normalize(value: number): number {
    return Math.max(0, Math.min(1, (value + 1) / 2));
  }
}
