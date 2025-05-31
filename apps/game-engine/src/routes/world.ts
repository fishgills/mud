import { Router } from 'express';
import prisma from '../prisma';

const router = Router();

// World seeding
router.post('/seed-world', async (req, res) => {
  try {
    let biome = await prisma.biome.findFirst({ where: { name: 'Valley' } });
    if (!biome) {
      biome = await prisma.biome.create({ data: { name: 'Valley', description: 'A lush valley with a small town.' } });
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        const desc = (x === 2 && y === 2)
          ? 'The town square, bustling with activity.'
          : 'A quiet part of the small valley town.';
        await prisma.worldTile.upsert({
          where: { x_y_z: { x, y, z: 0 } },
          update: {},
          create: { x, y, z: 0, biomeId: biome.id, description: desc },
        });
      }
    }
    return res.json({ status: 'world seeded' });
  } catch {
    return res.status(500).json({ error: 'Failed to seed world' });
  }
});

export default router;
