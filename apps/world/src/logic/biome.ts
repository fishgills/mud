import prisma from '../prisma';
import { BiomeRegistry } from './biome-definitions';

export async function seedBiomes() {
  const biomeNames = BiomeRegistry.getAllNames();

  // Delete any biomes in the database that are not in the registry
  const dbBiomes = await prisma.biome.findMany({ select: { name: true } });
  const dbBiomeNames = dbBiomes.map((b) => b.name);
  const toDelete = dbBiomeNames.filter((name) => !biomeNames.includes(name));
  if (toDelete.length > 0) {
    await prisma.biome.deleteMany({ where: { name: { in: toDelete } } });
  }

  // Upsert all biomes from the registry
  for (const biomeName of biomeNames) {
    await prisma.biome.upsert({
      where: { name: biomeName },
      update: {},
      create: {
        name: biomeName,
      },
    });
  }
}
