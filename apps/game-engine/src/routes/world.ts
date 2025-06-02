
import { Router } from 'express';
import prisma from '../prisma';
import { seedBiomes } from '../logic/biome';
const router = Router();

// Reset world: delete all tiles
router.post('/reset', async (req, res) => {
  try {
    await prisma.worldTile.deleteMany({});
    console.log('[world] All tiles deleted.');
    return res.json({ success: true });
  } catch (err) {
    console.error('[world] Error deleting tiles:', err);
    return res.status(500).json({ error: 'Failed to reset world' });
  }
});


// GET /world/grid?size=11
// Returns a text grid of the world for the given size (default 11x11, centered at 0,0)
router.get('/grid', async (req, res) => {
  const size = req.query.size ? Number(req.query.size) : 11;
  const half = Math.floor(size / 2);
  // Get all tiles in the grid
  const tiles = await prisma.worldTile.findMany({
    where: {
      x: { gte: -half, lte: half },
      y: { gte: -half, lte: half },
    },
    include: { biome: true },
  });
  // Map biome names to single letters
  const biomeLetter: Record<string, string> = {
    city: 'C',
    village: 'V',
    forest: 'F',
    desert: 'D',
    plains: 'P',
    mountains: 'M',
    hills: 'H',
  };
  // Build a grid
  const grid: string[][] = [];
  for (let y = half; y >= -half; y--) {
    const row: string[] = [];
    for (let x = -half; x <= half; x++) {
      const tile = tiles.find(t => t.x === x && t.y === y);
      if (tile && tile.biome) {
        row.push(biomeLetter[tile.biome.name] || '?');
      } else {
        row.push('.');
      }
    }
    grid.push(row);
  }
  // Join rows into a string
  const text = grid.map(row => row.join(' ')).join('\n');
  res.type('text/plain').send(text);
});

// GET /world/grid?z=0&size=11
// Returns a text grid of the world for the given z (default 0) and size (default 11x11, centered at 0,0)
router.get('/grid', async (req, res) => {
  const size = req.query.size ? Number(req.query.size) : 11;
  const half = Math.floor(size / 2);
  // Get all tiles in the grid
  const tiles = await prisma.worldTile.findMany({
    where: {
      x: { gte: -half, lte: half },
      y: { gte: -half, lte: half },
    },
    include: { biome: true },
  });
  // Map biome names to single letters
  const biomeLetter: Record<string, string> = {
    city: 'C',
    village: 'V',
    forest: 'F',
    desert: 'D',
    plains: 'P',
    mountains: 'M',
    hills: 'H',
    sewers: 'S',
    caves: 'X',
  };
  // Build a grid
  const grid: string[][] = [];
  for (let y = half; y >= -half; y--) {
    const row: string[] = [];
    for (let x = -half; x <= half; x++) {
      const tile = tiles.find(t => t.x === x && t.y === y);
      if (tile) {
        row.push(biomeLetter[tile.biome.name] || '?');
      } else {
        row.push('.');
      }
    }
    grid.push(row);
  }
  // Join rows into a string
  const text = grid.map(row => row.join(' ')).join('\n');
  res.type('text/plain').send(text);
});

// World seeding (biomes and a small town)
router.post('/seed', async (req, res) => {
  try {
    await seedBiomes();
    // Use 'city' biome for the town
    const biome = await prisma.biome.findUnique({ where: { name: 'city' } });
    if (!biome) return res.status(500).json({ error: 'City biome missing' });
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const desc = (x === 2 && y === 2)
          ? 'The town square, bustling with activity.'
          : 'A quiet part of the small city.';
        await prisma.worldTile.upsert({
          where: { x_y: { x, y } },
          update: {},
          create: { x, y, biomeId: biome.id, description: desc },
        });
      }
    }
    return res.json({ status: 'world seeded' });
  } catch {
    return res.status(500).json({ error: 'Failed to seed world' });
  }
});

export default router;
