import prisma from '../prisma';
import redis from '../redis';

// Biome size limits
export const BIOME_SIZE_LIMITS: Record<string, number> = {
  city: 5,
  village: 8,
  forest: 25,
  desert: 30,
  plains: 40,
  mountains: 20,
  hills: 15,
};

// Min distance constraints
const MIN_CITY_DISTANCE = 10;
const MIN_VILLAGE_DISTANCE = 6;

// Biome neighbor rules
const biomeNeighbors: Record<string, string[]> = {
  city: ['city', 'village', 'plains'],
  village: ['village', 'plains', 'forest'],
  plains: ['plains', 'village', 'forest', 'hills'],
  forest: ['forest', 'plains', 'hills'],
  hills: ['hills', 'plains', 'mountains', 'forest'],
  mountains: ['mountains', 'hills'],
  desert: ['desert', 'plains', 'hills'],
};

export interface WorldTile {
  id: number;
  x: number;
  y: number;
  biomeId: number;
  description: string;
  biomeMix?: Record<string, number>;
}

export async function getTileFromCache(x: number, y: number): Promise<WorldTile | null> {
  try {
    const cached = await redis.get(`tile:${x}:${y}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting tile from cache:', error);
    return null;
  }
}

export async function cacheTile(tile: WorldTile): Promise<void> {
  try {
    await redis.setEx(`tile:${tile.x}:${tile.y}`, 3600, JSON.stringify(tile)); // Cache for 1 hour
  } catch (error) {
    console.error('Error caching tile:', error);
  }
}

export async function generateTile(x: number, y: number): Promise<WorldTile> {
  // Check cache first
  const cached = await getTileFromCache(x, y);
  if (cached) {
    return cached;
  }

  // Check if tile already exists in database
  const existingTile = await prisma.worldTile.findUnique({ 
    where: { x_y: { x, y } },
    include: { biome: true }
  });
  
  if (existingTile) {
    const tile: WorldTile = {
      id: existingTile.id,
      x: existingTile.x,
      y: existingTile.y,
      biomeId: existingTile.biomeId,
      description: existingTile.description,
      biomeMix: existingTile.biomeMix as Record<string, number> || undefined,
    };
    await cacheTile(tile);
    return tile;
  }

  // Generate new tile
  const tile = await generateNewTile(x, y);
  
  // Cache the generated tile
  await cacheTile(tile);
  
  // Store in database asynchronously (don't wait for it)
  storeTileAsync(tile).catch(error => {
    console.error('Error storing tile async:', error);
  });
  
  return tile;
}

async function generateNewTile(x: number, y: number): Promise<WorldTile> {
  // Look at adjacent tiles' biomes
  const neighborCoords = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
  
  const neighborTiles = await Promise.all(
    neighborCoords.map(([nx, ny]) =>
      prisma.worldTile.findUnique({ where: { x_y: { x: nx, y: ny } }, include: { biome: true } })
    )
  );
  
  const neighborBiomes = neighborTiles
    .map(t => t && t.biome ? t.biome.name : undefined)
    .filter(Boolean) as string[];

  // Determine previous biome (use plains as default)
  const prevBiome = neighborBiomes.length > 0 ? neighborBiomes[0] : 'plains';
  const allowedBiomes = biomeNeighbors[prevBiome] || ['plains'];

  // Count biomes among neighbors
  const biomeCounts: Record<string, number> = {};
  for (const b of neighborBiomes) {
    biomeCounts[b] = (biomeCounts[b] || 0) + 1;
  }

  // Weighted biome selection
  const weights: Record<string, number> = {};
  for (const biome of Object.keys(BIOME_SIZE_LIMITS)) {
    let weight = 1;
    
    // Stickiness: if adjacent, boost
    if (biomeCounts[biome]) weight += biomeCounts[biome] * 2;
    
    // If allowed neighbor, boost
    if (allowedBiomes.includes(biome)) weight += 1;
    
    // If over local presence, reduce
    if (biomeCounts[biome] && biomeCounts[biome] > 2) weight *= 0.5;
    
    // Check spacing constraints for special biomes
    if (biome === 'city') {
      if (await isBiomeNearby(x, y, 'city', MIN_CITY_DISTANCE)) weight = 0;
    }
    if (biome === 'village') {
      if (await isBiomeNearby(x, y, 'village', MIN_VILLAGE_DISTANCE)) weight = 0;
    }
    
    // Check biome size limits
    const contiguousSize = await estimateContiguousBiomeSize(x, y, biome, neighborTiles);
    if (contiguousSize >= BIOME_SIZE_LIMITS[biome]) weight = 0;
    
    // Add some noise
    weight *= 0.9 + Math.random() * 0.2;
    weights[biome] = weight;
  }

  // Pick the biome with the largest weight
  let biomeName = prevBiome;
  const maxWeight = Math.max(...Object.values(weights));
  const maxBiomes = Object.entries(weights).filter(([, w]) => w === maxWeight).map(([b]) => b);
  if (maxBiomes.length > 0) {
    biomeName = maxBiomes[Math.floor(Math.random() * maxBiomes.length)];
  }

  // Calculate biome mix (percentages)
  const mix: Record<string, number> = {};
  for (const b of neighborBiomes) {
    mix[b] = (mix[b] || 0) + 1;
  }
  mix[biomeName] = (mix[biomeName] || 0) + 2;
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  const biomeMix = Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, +(v / total).toFixed(2)]));

  // Get biome
  const biome = await prisma.biome.findUnique({ where: { name: biomeName } });
  const biomeId = biome?.id ?? 1;

  // Generate description
  const description = `You are in a ${biomeName} at (${x}, ${y}).`;

  return {
    id: 0, // Will be set when stored in database
    x,
    y,
    biomeId,
    description,
    biomeMix,
  };
}

async function storeTileAsync(tile: WorldTile): Promise<void> {
  try {
    const stored = await prisma.worldTile.create({
      data: {
        x: tile.x,
        y: tile.y,
        biomeId: tile.biomeId,
        description: tile.description,
        biomeMix: tile.biomeMix,
      },
    });
    
    // Update cache with real ID
    const updatedTile = { ...tile, id: stored.id };
    await cacheTile(updatedTile);
  } catch (error) {
    console.error('Error storing tile to database:', error);
  }
}

async function isBiomeNearby(x: number, y: number, biomeName: string, minDist: number): Promise<boolean> {
  const tiles = await prisma.worldTile.findMany({
    where: {
      biome: { name: biomeName },
      x: { gte: x - minDist, lte: x + minDist },
      y: { gte: y - minDist, lte: y + minDist },
    },
    select: { x: true, y: true },
  });
  
  for (const t of tiles) {
    const dist = Math.abs(t.x - x) + Math.abs(t.y - y);
    if (dist < minDist) return true;
  }
  return false;
}

async function estimateContiguousBiomeSize(
  x: number, 
  y: number, 
  biomeName: string, 
  neighborTiles: Array<{ x: number; y: number; biome: { name: string } | null } | null>
): Promise<number> {
  // Check if any neighbor has this biome
  const hasNeighborWithBiome = neighborTiles.some(
    tile => tile && tile.biome && tile.biome.name === biomeName
  );
  
  if (!hasNeighborWithBiome) {
    return 1; // Just this tile
  }
  
  // Find the largest connected region among neighbors
  let maxSize = 0;
  const neighborCoords = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
  
  for (const [nx, ny] of neighborCoords) {
    const neighbor = neighborTiles.find(t => t && t.x === nx && t.y === ny);
    if (neighbor && neighbor.biome && neighbor.biome.name === biomeName) {
      const size = await getContiguousBiomeSize(nx, ny, biomeName);
      if (size > maxSize) maxSize = size;
    }
  }
  
  return maxSize + 1; // +1 for the new tile we're placing
}

async function getContiguousBiomeSize(x: number, y: number, biomeName: string, maxTiles = 100): Promise<number> {
  const visited = new Set<string>();
  const queue: [number, number][] = [[x, y]];
  let count = 0;
  
  while (queue.length && count < maxTiles) {
    const next = queue.shift();
    if (!next) break;
    const [cx, cy] = next;
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    visited.add(key);
    
    const tile = await prisma.worldTile.findUnique({ 
      where: { x_y: { x: cx, y: cy } }, 
      include: { biome: true } 
    });
    
    if (!tile || !tile.biome || tile.biome.name !== biomeName) {
      continue;
    }
    
    count++;
    // Add 4 neighbors
    queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  
  return count;
}

export async function generateTileGrid(centerX: number, centerY: number, radius: number): Promise<WorldTile[]> {
  const tiles: WorldTile[] = [];
  
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      const x = centerX + dx;
      const y = centerY + dy;
      const tile = await generateTile(x, y);
      tiles.push(tile);
    }
  }
  
  return tiles;
}
