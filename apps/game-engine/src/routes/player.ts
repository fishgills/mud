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
    // Start at (2,2,0) (town square)
    const tile = await prisma.worldTile.findUnique({ where: { x_y_z: { x: 2, y: 2, z: 0 } } });
    if (!tile) {
      return res.status(400).json({ error: 'World not seeded' });
    }
    const player = await prisma.player.create({
      data: {
        slackId,
        name,
        x: 2,
        y: 2,
        z: 0,
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
  const directions: Record<string, [number, number, number]> = {
    n: [0, 1, 0],
    s: [0, -1, 0],
    e: [1, 0, 0],
    w: [-1, 0, 0],
    up: [0, 0, 1],
    down: [0, 0, -1],
  };
  if (!directions[direction]) {
    return res.status(400).json({ error: 'Invalid direction' });
  }
  try {
    const player = await prisma.player.findUnique({ where: { id: Number(id) } });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    const [dx, dy, dz] = directions[direction];
    const nx = player.x + dx;
    const ny = player.y + dy;
    const nz = player.z + dz;
    // Check if tile exists, or generate it if not
    let tile = await prisma.worldTile.findUnique({ where: { x_y_z: { x: nx, y: ny, z: nz } } });
    let generated = false;
    if (!tile) {
      // --- DEBUG LOGGING ---
      console.log(`[tilegen] Generating tile at (${nx},${ny},${nz}) for player ${player.id}`);
      // Biome neighbor map for smooth transitions
      const biomeNeighbors: Record<string, string[]> = {
        city: ['city', 'village', 'plains'],
        village: ['village', 'city', 'plains', 'forest'],
        plains: ['plains', 'village', 'forest', 'hills'],
        forest: ['forest', 'plains', 'hills'],
        hills: ['hills', 'plains', 'mountains', 'forest'],
        mountains: ['mountains', 'hills', 'caves'],
        caves: ['caves', 'mountains', 'sewers'],
        sewers: ['sewers', 'caves'],
        desert: ['desert', 'plains', 'hills'],
      };

      // Get previous tile's biome
      const prevTile = await prisma.worldTile.findUnique({ where: { x_y_z: { x: player.x, y: player.y, z: player.z } }, include: { biome: true } });
      const prevBiome = prevTile?.biome?.name || 'plains';
      const allowedBiomes = biomeNeighbors[prevBiome] || ['plains'];

      // Look at adjacent tiles' biomes
      const neighborCoords = [
        [nx + 1, ny, nz],
        [nx - 1, ny, nz],
        [nx, ny + 1, nz],
        [nx, ny - 1, nz],
      ];
      const neighborTiles = await Promise.all(
        neighborCoords.map(([x, y, z]) =>
          prisma.worldTile.findUnique({ where: { x_y_z: { x, y, z } }, include: { biome: true } })
        )
      );
      const neighborBiomes = neighborTiles
        .map(t => t?.biome?.name)
        .filter(Boolean) as string[];

      // Count biomes among neighbors
      const biomeCounts: Record<string, number> = {};
      for (const b of neighborBiomes) {
        biomeCounts[b] = (biomeCounts[b] || 0) + 1;
      }
      console.log(`[tilegen] Neighbor biomes:`, neighborBiomes, 'Counts:', biomeCounts);

      // Pick the most common neighbor biome, or previous biome if tie/none
      let biomeName = prevBiome;
      let maxCount = 0;
      for (const b of Object.keys(biomeCounts)) {
        if (biomeCounts[b] > maxCount) {
          biomeName = b;
          maxCount = biomeCounts[b];
        }
      }

      // Add more randomness: if there are multiple neighbor biomes, pick randomly among the most common
      const maxBiomes = Object.entries(biomeCounts).filter(([k, v]) => v === maxCount).map(([k]) => k);
      if (maxBiomes.length > 1 && Math.random() < 0.5) {
        biomeName = maxBiomes[Math.floor(Math.random() * maxBiomes.length)];
        console.log(`[tilegen] Randomly picked among most common neighbor biomes:`, maxBiomes, '->', biomeName);
      }

      // If no neighbors, or random chance, pick from allowed biomes
      if (neighborBiomes.length === 0 || (Math.random() < 0.2)) {
        biomeName = Math.random() < 0.7 ? prevBiome : allowedBiomes[Math.floor(Math.random() * allowedBiomes.length)];
        console.log(`[tilegen] Picked biome by fallback/random:`, biomeName);
      }

      // Occasional hard transition to desert, but only if a neighbor is desert or by rare chance
      if ((neighborBiomes.includes('desert') && Math.random() < 0.2) || (Math.abs(nx + ny) % 47 === 0 && Math.random() < 0.05)) {
        biomeName = 'desert';
        console.log(`[tilegen] Hard transition to desert.`);
      }

      // Handle z-levels
      if (nz < 0) biomeName = 'caves';
      else if (nz > 0) biomeName = 'mountains';

      // Calculate biome mix (percentages)
      const mix: Record<string, number> = {};
      for (const b of neighborBiomes) {
        mix[b] = (mix[b] || 0) + 1;
      }
      mix[biomeName] = (mix[biomeName] || 0) + 2;
      const total = Object.values(mix).reduce((a, b) => a + b, 0);
      const biomeMix = Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, +(v / total).toFixed(2)]));
      console.log(`[tilegen] Final biome:`, biomeName, 'BiomeMix:', biomeMix);

      // Get biome
      const biome = await prisma.biome.findUnique({ where: { name: biomeName } });
      // Generate a placeholder description
      const desc = `You are in a ${biomeName} at (${nx}, ${ny}, ${nz}).`;
      tile = await prisma.worldTile.create({
        data: {
          x: nx,
          y: ny,
          z: nz,
          biomeId: biome?.id ?? 1,
          description: desc,
          biomeMix,
        },
      });
      generated = true;
    }
    await prisma.player.update({
      where: { id: player.id },
      data: { x: nx, y: ny, z: nz, worldTileId: tile.id },
    });
    console.log(`[player] Move: id=${player.id}, name=${player.name}, from=(${player.x},${player.y},${player.z}) to=(${nx},${ny},${nz})${generated ? ' [generated tile]' : ''}`);
    // Return new location info
    const info = await getPlayerLocationInfo(player.id);
    if ('error' in info) {
      return res.status(info.status ?? 400).json({ error: info.error });
    }
    return res.json(info);
  } catch (err) {
    console.error('[player] Error moving player:', err);
    return res.status(500).json({ error: 'Failed to move player' });
  }
});

// List all players (demo)
router.get('/', async (req, res) => {
  const players = await prisma.player.findMany();
  res.json(players);
});

export default router;
