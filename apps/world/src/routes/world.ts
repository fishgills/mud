import { Router } from 'express';
import { generateTile, generateTileGrid } from '../logic/world';
import { seedBiomes } from '../logic/biome';
import prisma from '../prisma';

const router = Router();

// GET /tile/:x/:y - Get or generate a single tile
router.get('/tile/:x/:y', async (req, res) => {
  try {
    const x = parseInt(req.params.x);
    const y = parseInt(req.params.y);
    
    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    const tile = await generateTile(x, y);
    return res.json(tile);
  } catch (error) {
    console.error('Error generating tile:', error);
    return res.status(500).json({ error: 'Failed to generate tile' });
  }
});

// POST /grid - Generate a grid of tiles around a center point
router.post('/grid', async (req, res) => {
  try {
    const { centerX, centerY, radius = 5 } = req.body;
    
    if (typeof centerX !== 'number' || typeof centerY !== 'number') {
      return res.status(400).json({ error: 'centerX and centerY must be numbers' });
    }
    
    if (radius > 10) {
      return res.status(400).json({ error: 'Maximum radius is 10' });
    }
    
    const tiles = await generateTileGrid(centerX, centerY, radius);
    return res.json({ tiles, count: tiles.length });
  } catch (error) {
    console.error('Error generating tile grid:', error);
    return res.status(500).json({ error: 'Failed to generate tile grid' });
  }
});

// GET /grid - Get a text representation of the world grid
router.get('/grid', async (req, res) => {
  const size = req.query.size ? Number(req.query.size) : 11;
  const centerX = req.query.centerX ? Number(req.query.centerX) : 0;
  const centerY = req.query.centerY ? Number(req.query.centerY) : 0;
  
  const half = Math.floor(size / 2);
  
  // Get all tiles in the grid
  const tiles = await prisma.worldTile.findMany({
    where: {
      x: { gte: centerX - half, lte: centerX + half },
      y: { gte: centerY - half, lte: centerY + half },
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
  for (let y = centerY + half; y >= centerY - half; y--) {
    const row: string[] = [];
    for (let x = centerX - half; x <= centerX + half; x++) {
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

// POST /seed - Seed the world with initial biomes and starter town
router.post('/seed', async (req, res) => {
  try {
    await seedBiomes();
    
    // Create a small starting town at (2,2)
    const cityBiome = await prisma.biome.findUnique({ where: { name: 'city' } });
    if (!cityBiome) {
      return res.status(500).json({ error: 'City biome not found' });
    }
    
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const description = (x === 2 && y === 2)
          ? 'The town square, bustling with activity.'
          : 'A quiet part of the small city.';
        await prisma.worldTile.upsert({
          where: { x_y: { x, y } },
          update: {},
          create: { x, y, biomeId: cityBiome.id, description },
        });
      }
    }
    
    return res.json({ status: 'world seeded' });
  } catch (error) {
    console.error('Error seeding world:', error);
    return res.status(500).json({ error: 'Failed to seed world' });
  }
});

// DELETE /reset - Reset the world by deleting all tiles
router.delete('/reset', async (req, res) => {
  try {
    await prisma.worldTile.deleteMany({});
    console.log('[world] All tiles deleted.');
    return res.json({ success: true });
  } catch (error) {
    console.error('[world] Error deleting tiles:', error);
    return res.status(500).json({ error: 'Failed to reset world' });
  }
});

export default router;
