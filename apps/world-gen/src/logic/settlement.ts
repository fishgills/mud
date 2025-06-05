// Deterministic settlement generation logic
import seedrandom from 'seedrandom';
import { TileInfo } from '../services/chunkService';

export type SettlementType = 'city' | 'village' | 'hamlet' | 'farm';

export interface Settlement {
  name: string;
  type: SettlementType;
  x: number;
  y: number;
  size: string;
  population: number;
  description: string;
}

const SETTLEMENT_TYPES: {
  type: SettlementType;
  minPop: number;
  maxPop: number;
  size: string;
}[] = [
  { type: 'city', minPop: 1000, maxPop: 10000, size: 'large' },
  { type: 'village', minPop: 100, maxPop: 999, size: 'medium' },
  { type: 'hamlet', minPop: 20, maxPop: 99, size: 'small' },
  { type: 'farm', minPop: 1, maxPop: 19, size: 'tiny' },
];

// Deterministically decide if a tile should have a settlement
export function generateSettlementForTile(
  tile: TileInfo,
  worldSeed: string
): Settlement | null {
  // Only allow settlements on certain biomes
  if (!['plains', 'forest', 'desert', 'beach'].includes(tile.biome))
    return null;
  // Use a seeded RNG based on worldSeed and tile coordinates
  const rng = seedrandom(`${worldSeed}:${tile.x}:${tile.y}`);
  // Small chance for a settlement
  if (rng() > 0.01) return null;
  // Pick type
  const typeIdx = Math.floor(rng() * SETTLEMENT_TYPES.length);
  const typeInfo = SETTLEMENT_TYPES[typeIdx];
  const population =
    Math.floor(rng() * (typeInfo.maxPop - typeInfo.minPop + 1)) +
    typeInfo.minPop;
  const name = `${
    typeInfo.type.charAt(0).toUpperCase() + typeInfo.type.slice(1)
  } of (${tile.x},${tile.y})`;
  return {
    name,
    type: typeInfo.type,
    x: tile.x,
    y: tile.y,
    size: typeInfo.size,
    population,
    description: `${typeInfo.size} ${typeInfo.type} with population ${population}`,
  };
}
