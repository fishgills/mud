import { Router } from 'express';
import prisma from '../prisma';
import { seedBiomes } from '../logic/biome';

const router = Router();

// World seeding (biomes and a small town)
router.post('/seed-world', async (req, res) => {
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
