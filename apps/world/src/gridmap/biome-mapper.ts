import { BIOMES } from '../constants';
import { BiomeInfo } from '../world/types';
import { GridBiome } from './interfaces';

const GRID_TO_WORLD: Record<string, keyof typeof BIOMES> = {
  water: 'SHALLOW_OCEAN',
  'deep water': 'OCEAN',
  beach: 'BEACH',
  plain: 'GRASSLAND',
  forest: 'FOREST',
  mountain: 'MOUNTAIN',
  'ice sea': 'TUNDRA',
  shore: 'SHALLOW_OCEAN',
  rock: 'MOUNTAIN',
  snow: 'SNOWY_MOUNTAIN',
  savana: 'SAVANNA',
};

export function mapGridBiomeToBiomeInfo(biome: GridBiome): BiomeInfo {
  const key = GRID_TO_WORLD[biome.name.toLowerCase()];
  return key ? BIOMES[key] : BIOMES.GRASSLAND;
}
