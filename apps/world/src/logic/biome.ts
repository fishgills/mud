import prisma from '../prisma';
import { BiomeRegistry } from './biome-definitions';

export async function seedBiomes() {
  const biomeNames = BiomeRegistry.getAllNames();
  
  for (const biomeName of biomeNames) {
    await prisma.biome.upsert({
      where: { name: biomeName },
      update: {},
      create: { 
        name: biomeName      },
    });
  }
}
