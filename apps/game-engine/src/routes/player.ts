import { Router } from 'express';
import prisma from '../prisma';
import { getPlayerLocationInfo } from '../logic/player';

const router = Router();

// Player creation
router.post('/', async (req, res) => {
  const { slackId, name } = req.body;
  if (!slackId || !name) {
    return res.status(400).json({ error: 'Missing slackId or name' });
  }
  try {
    // Start at (2,2) (town square)
    const tile = await prisma.worldTile.findUnique({ where: { x_y: { x: 2, y: 2 } } });
    if (!tile) {
      return res.status(400).json({ error: 'World not seeded' });
    }
    const player = await prisma.player.create({
      data: {
        slackId,
        name,
        x: 2,
        y: 2,
        hp: 10,
        worldTileId: tile.id,
      },
    });
    console.log(`[player] Created: id=${player.id}, name=${player.name}, slackId=${player.slackId}`);
    return res.json(player);
  } catch (err) {
    console.error('[player] Error creating player:', err);
    return res.status(500).json({ error: 'Failed to create player' });
  }
});

// POST /players/:id/generate-grid
// Moves a player in a 20x20 grid to generate tiles for testing
router.post('/:id/generate-grid', async (req, res) => {
  const { id } = req.params;
  const player = await prisma.player.findUnique({ where: { id: Number(id) } });
  if (!player) {
    res.status(404).json({ error: 'Player not found' });
    return;
  }
  let px = player.x;
  let py = player.y;
  const visited = new Set();
  const moves: [number, number][] = [];
  // Generate a simple spiral or snake pattern
  for (let y = -10; y <= 10; y++) {
    for (let x = -10; x <= 10; x++) {
      moves.push([x, y]);
    }
  }
  for (const [x, y] of moves) {
    // Only move if not already at that position
    if (px !== x || py !== y) {
      // Move in x
      while (px !== x) {
        const dir = px < x ? 'e' : 'w';
        await movePlayer(id, dir);
        px += dir === 'e' ? 1 : -1;
      }
      // Move in y
      while (py !== y) {
        const dir = py < y ? 'n' : 's';
        await movePlayer(id, dir);
        py += dir === 'n' ? 1 : -1;
      }
    }
    visited.add(`${x},${y}`);
  }
  res.json({ status: 'done', visited: visited.size });
});

// Shared player movement logic
async function movePlayerInternal(id: string, direction: string): Promise<boolean> {
  // --- Configurable parameters ---
  const TILE_GEN_RADIUS = Number(process.env.TILE_GEN_RADIUS) || 3; // 3 = 7x7, 2 = 5x5
  const BIOME_SIZE_LIMITS: Record<string, number> = {
    city: Number(process.env.BIOME_CITY_LIMIT) || 100,
    village: Number(process.env.BIOME_VILLAGE_LIMIT) || 25,
    forest: Number(process.env.BIOME_FOREST_LIMIT) || 400,
    desert: Number(process.env.BIOME_DESERT_LIMIT) || 600,
    plains: Number(process.env.BIOME_PLAINS_LIMIT) || 800,
    mountains: Number(process.env.BIOME_MOUNTAINS_LIMIT) || 300,
    hills: Number(process.env.BIOME_HILLS_LIMIT) || 200,
  };
  const MIN_CITY_DISTANCE = Number(process.env.MIN_CITY_DISTANCE) || 20;
  const MIN_VILLAGE_DISTANCE = Number(process.env.MIN_VILLAGE_DISTANCE) || 10;

  const directions: Record<string, [number, number]> = {
    n: [0, 1],
    s: [0, -1],
    e: [1, 0],
    w: [-1, 0],
  };
  if (!directions[direction]) return false;
  try {
    const player = await prisma.player.findUnique({ where: { id: Number(id) } });
    if (!player) return false;
    const [dx, dy] = directions[direction];
    const nx = player.x + dx;
    const ny = player.y + dy;
    // Biome adjacency map
    const biomeNeighbors: Record<string, string[]> = {
      city: ['city', 'village'],
      village: ['village', 'city', 'plains', 'forest'],
      plains: ['plains', 'village', 'forest', 'hills'],
      forest: ['forest', 'plains', 'hills'],
      hills: ['hills', 'plains', 'mountains', 'forest'],
      mountains: ['mountains', 'hills'],
      desert: ['desert', 'plains', 'hills'],
    };

    // Get previous tile's biome
    const prevTile = await prisma.worldTile.findUnique({ where: { x_y: { x: player.x, y: player.y } }, include: { biome: true } });
    const prevBiome = prevTile?.biome?.name || 'plains';
    const allowedBiomes = biomeNeighbors[prevBiome] || ['plains'];

    // Helper: count contiguous biome region size (simple BFS)
    async function getContiguousBiomeSize(x: number, y: number, biomeName: string, maxTiles = 1000): Promise<number> {
      const visited = new Set<string>();
      const queue: [number, number][] = [[x, y]];
      let count = 0;
      while (queue.length && count < maxTiles) {
        const [cx, cy] = queue.shift()!;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const tile = await prisma.worldTile.findUnique({ where: { x_y: { x: cx, y: cy } }, include: { biome: true } });
        if (!tile) {
          console.debug(`[getContiguousBiomeSize] No tile at (${cx},${cy}) for biome '${biomeName}'`);
          continue;
        }
        if (!tile.biome) {
          console.debug(`[getContiguousBiomeSize] Tile at (${cx},${cy}) missing biome for '${biomeName}'`);
          continue;
        }
        if (tile.biome.name !== biomeName) {
          console.debug(`[getContiguousBiomeSize] Tile at (${cx},${cy}) biome '${tile.biome.name}' !== '${biomeName}'`);
          continue;
        }
        count++;
        // Add 4 neighbors
        queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      console.debug(`[getContiguousBiomeSize] Final count for biome '${biomeName}' from (${x},${y}): ${count}`);
      return count;
    }

    // Helper: find nearest tile of a biome within a radius
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

    // Generate all tiles in a configurable grid centered on the player's current location (before move)
    for (let dxg = -TILE_GEN_RADIUS; dxg <= TILE_GEN_RADIUS; dxg++) {
      for (let dyg = -TILE_GEN_RADIUS; dyg <= TILE_GEN_RADIUS; dyg++) {
        const tx = player.x + dxg;
        const ty = player.y + dyg;
        let tile = await prisma.worldTile.findUnique({ where: { x_y: { x: tx, y: ty } } });
        if (!tile) {
          // Look at adjacent tiles' biomes
          const neighborCoords = [
            [tx + 1, ty],
            [tx - 1, ty],
            [tx, ty + 1],
            [tx, ty - 1],
          ];
          const neighborTiles = await Promise.all(
            neighborCoords.map(([x, y]) =>
              prisma.worldTile.findUnique({ where: { x_y: { x, y } }, include: { biome: true } })
            )
          );
          const neighborBiomes = neighborTiles
            .map(t => t && t.biome ? t.biome.name : undefined)
            .filter(Boolean) as string[];

          // Count biomes among neighbors
          const biomeCounts: Record<string, number> = {};
          for (const b of neighborBiomes) {
            biomeCounts[b] = (biomeCounts[b] || 0) + 1;
          }

          // --- Weighted biome selection ---
          const weights: Record<string, number> = {};
          for (const biome of Object.keys(BIOME_SIZE_LIMITS)) {
            let weight = 1;
            // Stickiness: if adjacent, boost
            if (biomeCounts[biome]) weight += biomeCounts[biome] * 2;
            // If allowed neighbor, boost
            if (allowedBiomes.includes(biome)) weight += 1;
            // If over local presence, reduce
            if (biomeCounts[biome] && biomeCounts[biome] > 2) weight *= 0.5;
            // If city/village, check spacing
            if (biome === 'city') {
              if (await isBiomeNearby(tx, ty, 'city', MIN_CITY_DISTANCE)) weight = 0;
            }
            if (biome === 'village') {
              if (await isBiomeNearby(tx, ty, 'village', MIN_VILLAGE_DISTANCE)) weight = 0;
            }
            // If biome region is too large, block
            // Only check contiguous size if a tile of this biome would exist at (tx, ty)
            // Simulate the tile's existence by checking neighbors and itself
            let contiguousSize = 0;
            const existingTile = await prisma.worldTile.findUnique({ where: { x_y: { x: tx, y: ty } }, include: { biome: true } });
            if (existingTile && existingTile.biome && existingTile.biome.name === biome) {
              contiguousSize = await getContiguousBiomeSize(tx, ty, biome);
            } else {
              // Simulate: check if any neighbor is of this biome, and if so, count the region size from that neighbor + 1 for this tile
              const neighborCoords = [
                [tx + 1, ty],
                [tx - 1, ty],
                [tx, ty + 1],
                [tx, ty - 1],
              ];
              let maxNeighborSize = 0;
              for (const [nx, ny] of neighborCoords) {
                const neighborTile = await prisma.worldTile.findUnique({ where: { x_y: { x: nx, y: ny } }, include: { biome: true } });
                if (neighborTile && neighborTile.biome && neighborTile.biome.name === biome) {
                  const size = await getContiguousBiomeSize(nx, ny, biome);
                  if (size > maxNeighborSize) maxNeighborSize = size;
                }
              }
              contiguousSize = maxNeighborSize + 1; // +1 for the tile we're about to place
            }
            if (contiguousSize >= BIOME_SIZE_LIMITS[biome]) weight = 0;
            // Add some noise
            weight *= 0.9 + Math.random() * 0.2;
            weights[biome] = weight;
          }
          // Pick the biome with the largest weight (if tie, pick randomly among them)
          let biomeName = prevBiome;
          const maxWeight = Math.max(...Object.values(weights));
          const maxBiomes = Object.entries(weights).filter(([, w]) => w === maxWeight).map(([b]) => b);
          if (maxBiomes.length > 0) {
            biomeName = maxBiomes[Math.floor(Math.random() * maxBiomes.length)];
          }

          // No z-levels

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
          // Generate a placeholder description
          const desc = `You are in a ${biomeName} at (${tx}, ${ty}).`;
          tile = await prisma.worldTile.create({
            data: {
              x: tx,
              y: ty,
              biomeId: biome?.id ?? 1,
              description: desc,
              biomeMix,
            },
          });
        }
      }
    }
    // After generating the grid, move the player to the new tile
    const tile = await prisma.worldTile.findUnique({ where: { x_y: { x: nx, y: ny } } });
    if (!tile) return false;
    await prisma.player.update({
      where: { id: player.id },
      data: { x: nx, y: ny, worldTileId: tile.id },
    });
    console.log(`[player] Move: id=${player.id}, name=${player.name}, from=(${player.x},${player.y}) to=(${nx},${ny})`);
    return true;
  } catch (err) {
    console.error('[player] Error moving player:', err);
    return false;
  }
}

// Helper to move a player in a direction (returns boolean)
async function movePlayer(id: string, direction: string): Promise<boolean> {
  return movePlayerInternal(id, direction);
}
// Player location
router.get('/:id/location', async (req, res) => {
  const { id } = req.params;
  try {
    const info = await getPlayerLocationInfo(Number(id));
    if ('error' in info) {
      return res.status(info.status ?? 400).json({ error: info.error });
    }
    return res.json(info);
  } catch {
    return res.status(500).json({ error: 'Failed to get player location' });
  }
});

// Player movement
router.post('/:id/move', async (req, res) => {
  const { id } = req.params;
  const { direction } = req.body;
  const success = await movePlayerInternal(id, direction);
  if (!success) {
    return res.status(400).json({ error: 'Failed to move player' });
  }
  // Optionally, return updated player location info
  const info = await getPlayerLocationInfo(Number(id));
  if ('error' in info) {
    return res.status(info.status ?? 400).json({ error: info.error });
  }
  return res.json(info);
});

// List all players (demo)
router.get('/', async (req, res) => {
  const players = await prisma.player.findMany();
  res.json(players);
});

export default router;
