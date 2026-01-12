/**
 * Autotile Mapping - Bitmasking algorithm for RPG Maker-style blob tilesets
 *
 * Maps 256 possible 8-neighbor configurations to 47 tile variants using bitmasking.
 *
 * Bit values for 8 neighbors:
 * - North (N): 1
 * - East (E): 2
 * - South (S): 4
 * - West (W): 8
 * - Northeast (NE): 16
 * - Southeast (SE): 32
 * - Southwest (SW): 64
 * - Northwest (NW): 128
 *
 * A tile's neighbors are checked - if a neighbor is the SAME biome, its bit is set.
 * Sum all bits to get an index 0-255, which maps to one of 47 tile variants.
 */

// Neighbor bit positions
export const NEIGHBOR_BITS = {
  N: 1,
  E: 2,
  S: 4,
  W: 8,
  NE: 16,
  SE: 32,
  SW: 64,
  NW: 128,
} as const;

// Tile variant indices (47 total for blob tileset)
export enum TileVariant {
  // Center tile (all neighbors same)
  CENTER = 0,

  // Single edges (one side different)
  EDGE_N = 1,
  EDGE_E = 2,
  EDGE_S = 3,
  EDGE_W = 4,

  // Outer corners (two adjacent sides different)
  CORNER_NE = 5,
  CORNER_SE = 6,
  CORNER_SW = 7,
  CORNER_NW = 8,

  // Inner corners (diagonal neighbor different, orthogonal same)
  INNER_CORNER_NE = 9,
  INNER_CORNER_SE = 10,
  INNER_CORNER_SW = 11,
  INNER_CORNER_NW = 12,

  // Edge + Inner corner combinations
  EDGE_N_INNER_NE = 13,
  EDGE_N_INNER_NW = 14,
  EDGE_S_INNER_SE = 15,
  EDGE_S_INNER_SW = 16,
  EDGE_E_INNER_NE = 17,
  EDGE_E_INNER_SE = 18,
  EDGE_W_INNER_NW = 19,
  EDGE_W_INNER_SW = 20,

  // Two opposite edges
  EDGE_NS = 21,
  EDGE_EW = 22,

  // Two opposite inner corners
  INNER_CORNER_NE_SW = 23,
  INNER_CORNER_NW_SE = 24,

  // Three edges (one side same)
  EDGE_NES = 25,
  EDGE_ESW = 26,
  EDGE_NSW = 27,
  EDGE_NEW = 28,

  // Complex combinations (multiple edges + inner corners)
  EDGE_NS_INNER_NE = 29,
  EDGE_NS_INNER_SE = 30,
  EDGE_NS_INNER_SW = 31,
  EDGE_NS_INNER_NW = 32,
  EDGE_EW_INNER_NE = 33,
  EDGE_EW_INNER_SE = 34,
  EDGE_EW_INNER_SW = 35,
  EDGE_EW_INNER_NW = 36,

  // All four inner corners
  INNER_CORNER_ALL = 37,

  // Three edges + inner corner
  EDGE_NES_INNER_NE = 38,
  EDGE_ESW_INNER_SE = 39,
  EDGE_NSW_INNER_SW = 40,
  EDGE_NEW_INNER_NW = 41,

  // All four edges (island)
  ISLAND = 42,

  // Edge + two inner corners
  EDGE_N_INNER_NE_NW = 43,
  EDGE_S_INNER_SE_SW = 44,
  EDGE_E_INNER_NE_SE = 45,
  EDGE_W_INNER_NW_SW = 46,
}

/**
 * Lookup table mapping bit masks to tile variants.
 * This is a simplified mapping - in practice, many bit combinations map to the same variant.
 * For a full 47-variant blob tileset, this would be a 256-entry lookup table.
 */
const BITMASK_TO_VARIANT: Map<number, TileVariant> = new Map();

/**
 * Initialize the bitmask lookup table.
 * This maps all 256 possible neighbor configurations to one of 47 tile variants.
 */
function initializeBitmaskLookup(): void {
  const { N, E, S, W, NE, SE, SW, NW } = NEIGHBOR_BITS;

  // Center tile (all neighbors same = all bits set)
  BITMASK_TO_VARIANT.set(N | E | S | W | NE | SE | SW | NW, TileVariant.CENTER);

  // Single edges
  BITMASK_TO_VARIANT.set(E | S | W | NE | SE | SW | NW, TileVariant.EDGE_N);
  BITMASK_TO_VARIANT.set(N | S | W | NE | SE | SW | NW, TileVariant.EDGE_E);
  BITMASK_TO_VARIANT.set(N | E | W | NE | SE | SW | NW, TileVariant.EDGE_S);
  BITMASK_TO_VARIANT.set(N | E | S | NE | SE | SW | NW, TileVariant.EDGE_W);

  // Outer corners
  BITMASK_TO_VARIANT.set(S | W | SE | SW | NW, TileVariant.CORNER_NE);
  BITMASK_TO_VARIANT.set(N | W | NE | SW | NW, TileVariant.CORNER_SE);
  BITMASK_TO_VARIANT.set(N | E | NE | SE | NW, TileVariant.CORNER_SW);
  BITMASK_TO_VARIANT.set(E | S | NE | SE | SW, TileVariant.CORNER_NW);

  // Inner corners (orthogonal neighbors same, diagonal different)
  BITMASK_TO_VARIANT.set(
    N | E | S | W | SE | SW | NW,
    TileVariant.INNER_CORNER_NE,
  );
  BITMASK_TO_VARIANT.set(
    N | E | S | W | NE | SW | NW,
    TileVariant.INNER_CORNER_SE,
  );
  BITMASK_TO_VARIANT.set(
    N | E | S | W | NE | SE | NW,
    TileVariant.INNER_CORNER_SW,
  );
  BITMASK_TO_VARIANT.set(
    N | E | S | W | NE | SE | SW,
    TileVariant.INNER_CORNER_NW,
  );

  // Edge + inner corner combinations
  BITMASK_TO_VARIANT.set(E | S | W | SE | SW | NW, TileVariant.EDGE_N_INNER_NE);
  BITMASK_TO_VARIANT.set(E | S | W | NE | SE | SW, TileVariant.EDGE_N_INNER_NW);
  BITMASK_TO_VARIANT.set(N | E | W | NE | SE | NW, TileVariant.EDGE_S_INNER_SE);
  BITMASK_TO_VARIANT.set(N | E | W | NE | SW | NW, TileVariant.EDGE_S_INNER_SW);
  BITMASK_TO_VARIANT.set(N | S | W | SE | SW | NW, TileVariant.EDGE_E_INNER_NE);
  BITMASK_TO_VARIANT.set(N | S | W | NE | SW | NW, TileVariant.EDGE_E_INNER_SE);
  BITMASK_TO_VARIANT.set(N | E | S | NE | SE | SW, TileVariant.EDGE_W_INNER_NW);
  BITMASK_TO_VARIANT.set(N | E | S | NE | SE | NW, TileVariant.EDGE_W_INNER_SW);

  // Opposite edges
  BITMASK_TO_VARIANT.set(E | W | NE | SE | SW | NW, TileVariant.EDGE_NS);
  BITMASK_TO_VARIANT.set(N | S | NE | SE | SW | NW, TileVariant.EDGE_EW);

  // Opposite inner corners
  BITMASK_TO_VARIANT.set(
    N | E | S | W | SE | NW,
    TileVariant.INNER_CORNER_NE_SW,
  );
  BITMASK_TO_VARIANT.set(
    N | E | S | W | NE | SW,
    TileVariant.INNER_CORNER_NW_SE,
  );

  // Three edges
  BITMASK_TO_VARIANT.set(W | SE | SW | NW, TileVariant.EDGE_NES);
  BITMASK_TO_VARIANT.set(N | NE | SW | NW, TileVariant.EDGE_ESW);
  BITMASK_TO_VARIANT.set(E | NE | SE | SW, TileVariant.EDGE_NSW);
  BITMASK_TO_VARIANT.set(S | NE | SE | NW, TileVariant.EDGE_NEW);

  // Complex combinations with multiple inner corners
  BITMASK_TO_VARIANT.set(E | W | SE | SW | NW, TileVariant.EDGE_NS_INNER_NE);
  BITMASK_TO_VARIANT.set(E | W | NE | SW | NW, TileVariant.EDGE_NS_INNER_SE);
  BITMASK_TO_VARIANT.set(E | W | NE | SE | NW, TileVariant.EDGE_NS_INNER_SW);
  BITMASK_TO_VARIANT.set(E | W | NE | SE | SW, TileVariant.EDGE_NS_INNER_NW);
  BITMASK_TO_VARIANT.set(N | S | SE | SW | NW, TileVariant.EDGE_EW_INNER_NE);
  BITMASK_TO_VARIANT.set(N | S | NE | SW | NW, TileVariant.EDGE_EW_INNER_SE);
  BITMASK_TO_VARIANT.set(N | S | NE | SE | NW, TileVariant.EDGE_EW_INNER_SW);
  BITMASK_TO_VARIANT.set(N | S | NE | SE | SW, TileVariant.EDGE_EW_INNER_NW);

  // All four inner corners
  BITMASK_TO_VARIANT.set(N | E | S | W, TileVariant.INNER_CORNER_ALL);

  // Three edges + inner corner
  BITMASK_TO_VARIANT.set(W | SE | NW, TileVariant.EDGE_NES_INNER_NE);
  BITMASK_TO_VARIANT.set(N | NE | SW, TileVariant.EDGE_ESW_INNER_SE);
  BITMASK_TO_VARIANT.set(E | NE | SW, TileVariant.EDGE_NSW_INNER_SW);
  BITMASK_TO_VARIANT.set(S | SE | NW, TileVariant.EDGE_NEW_INNER_NW);

  // Island (no neighbors same)
  BITMASK_TO_VARIANT.set(0, TileVariant.ISLAND);

  // Edge + two inner corners
  BITMASK_TO_VARIANT.set(E | S | W | SE | SW, TileVariant.EDGE_N_INNER_NE_NW);
  BITMASK_TO_VARIANT.set(N | E | W | NE | NW, TileVariant.EDGE_S_INNER_SE_SW);
  BITMASK_TO_VARIANT.set(N | S | W | SW | NW, TileVariant.EDGE_E_INNER_NE_SE);
  BITMASK_TO_VARIANT.set(N | E | S | NE | SE, TileVariant.EDGE_W_INNER_NW_SW);

  // Fill in remaining combinations with closest matches or default to CENTER
  for (let mask = 0; mask < 256; mask++) {
    if (!BITMASK_TO_VARIANT.has(mask)) {
      // Default strategy: count matching neighbors and pick closest variant
      const variant = getBestVariantForMask(mask);
      BITMASK_TO_VARIANT.set(mask, variant);
    }
  }
}

/**
 * Determine the best tile variant for an unmapped bit mask.
 * Uses pattern matching to find the closest defined variant.
 */
function getBestVariantForMask(mask: number): TileVariant {
  const { N, E, S, W, NE, SE, SW, NW } = NEIGHBOR_BITS;

  const hasN = (mask & N) !== 0;
  const hasE = (mask & E) !== 0;
  const hasS = (mask & S) !== 0;
  const hasW = (mask & W) !== 0;
  const hasNE = (mask & NE) !== 0;
  const hasSE = (mask & SE) !== 0;
  const hasSW = (mask & SW) !== 0;
  const hasNW = (mask & NW) !== 0;

  // Count cardinal matches
  const cardinalCount = [hasN, hasE, hasS, hasW].filter(Boolean).length;

  // If all cardinals match, check diagonals
  if (cardinalCount === 4) {
    const diagonalCount = [hasNE, hasSE, hasSW, hasNW].filter(Boolean).length;
    if (diagonalCount === 4) return TileVariant.CENTER;
    if (diagonalCount === 0) return TileVariant.INNER_CORNER_ALL;
    // Missing one or more diagonals = inner corners
    if (!hasNE) return TileVariant.INNER_CORNER_NE;
    if (!hasSE) return TileVariant.INNER_CORNER_SE;
    if (!hasSW) return TileVariant.INNER_CORNER_SW;
    if (!hasNW) return TileVariant.INNER_CORNER_NW;
  }

  // Missing one cardinal = edge
  if (cardinalCount === 3) {
    if (!hasN) return TileVariant.EDGE_N;
    if (!hasE) return TileVariant.EDGE_E;
    if (!hasS) return TileVariant.EDGE_S;
    if (!hasW) return TileVariant.EDGE_W;
  }

  // Missing two adjacent cardinals = corner
  if (cardinalCount === 2) {
    if (hasS && hasW) return TileVariant.CORNER_NE;
    if (hasN && hasW) return TileVariant.CORNER_SE;
    if (hasN && hasE) return TileVariant.CORNER_SW;
    if (hasE && hasS) return TileVariant.CORNER_NW;
    // Opposite edges
    if (hasN && hasS) return TileVariant.EDGE_EW;
    if (hasE && hasW) return TileVariant.EDGE_NS;
  }

  // Missing three cardinals
  if (cardinalCount === 1) {
    if (hasW) return TileVariant.EDGE_NES;
    if (hasN) return TileVariant.EDGE_ESW;
    if (hasE) return TileVariant.EDGE_NSW;
    if (hasS) return TileVariant.EDGE_NEW;
  }

  // No cardinals = island
  if (cardinalCount === 0) {
    return TileVariant.ISLAND;
  }

  // Default fallback
  return TileVariant.CENTER;
}

// Initialize lookup table on module load
initializeBitmaskLookup();

/**
 * Get the tile variant index for a given neighbor bitmask.
 * @param neighborMask - Bitmask of matching neighbors (0-255)
 * @returns Tile variant index (0-46)
 */
export function getAutoTileIndex(neighborMask: number): TileVariant {
  return BITMASK_TO_VARIANT.get(neighborMask) ?? TileVariant.CENTER;
}

/**
 * Build a neighbor bitmask by checking 8 surrounding tiles.
 * @param x - Tile X coordinate
 * @param y - Tile Y coordinate
 * @param biomeId - Current tile's biome ID
 * @param biomeMap - Map of "x,y" to biome ID for neighbor lookups
 * @returns Bitmask value (0-255)
 */
export function buildNeighborMask(
  x: number,
  y: number,
  biomeId: number,
  biomeMap: Map<string, number>,
): number {
  const { N, E, S, W, NE, SE, SW, NW } = NEIGHBOR_BITS;

  let mask = 0;

  // Check each neighbor - set bit if biome matches
  if (biomeMap.get(`${x},${y - 1}`) === biomeId) mask |= N;
  if (biomeMap.get(`${x + 1},${y}`) === biomeId) mask |= E;
  if (biomeMap.get(`${x},${y + 1}`) === biomeId) mask |= S;
  if (biomeMap.get(`${x - 1},${y}`) === biomeId) mask |= W;
  if (biomeMap.get(`${x + 1},${y - 1}`) === biomeId) mask |= NE;
  if (biomeMap.get(`${x + 1},${y + 1}`) === biomeId) mask |= SE;
  if (biomeMap.get(`${x - 1},${y + 1}`) === biomeId) mask |= SW;
  if (biomeMap.get(`${x - 1},${y - 1}`) === biomeId) mask |= NW;

  return mask;
}
