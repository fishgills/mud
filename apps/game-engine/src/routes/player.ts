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
    return res.json(player);
  } catch {
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
    if (!tile) {
      // Pick a biome (simple: city for z=0, caves for z<0, mountains for z>0, else random)
      let biomeName = 'plains';
      if (nz < 0) biomeName = 'caves';
      else if (nz > 0) biomeName = 'mountains';
      else if (Math.abs(nx) < 5 && Math.abs(ny) < 5) biomeName = 'city';
      else if (Math.abs(nx) < 10 && Math.abs(ny) < 10) biomeName = 'village';
      else if (Math.abs(nx) % 7 === 0 || Math.abs(ny) % 7 === 0) biomeName = 'forest';
      else if ((nx + ny) % 13 === 0) biomeName = 'desert';
      else if ((nx + ny) % 11 === 0) biomeName = 'hills';
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
        },
      });
    }
    await prisma.player.update({
      where: { id: player.id },
      data: { x: nx, y: ny, z: nz, worldTileId: tile.id },
    });
    // Return new location info
    const info = await getPlayerLocationInfo(player.id);
    if ('error' in info) {
      return res.status(info.status ?? 400).json({ error: info.error });
    }
    return res.json(info);
  } catch {
    return res.status(500).json({ error: 'Failed to move player' });
  }
});

// List all players (demo)
router.get('/', async (req, res) => {
  const players = await prisma.player.findMany();
  res.json(players);
});

export default router;
