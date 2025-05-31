import prisma from '../prisma';

export const BIOMES = [
  { name: 'forest', description: 'A dense forest with tall trees.' },
  { name: 'village', description: 'A small village with a few houses.' },
  { name: 'city', description: 'A bustling city full of life.' },
  { name: 'desert', description: 'A vast, arid desert.' },
  { name: 'plains', description: 'Open plains with tall grass.' },
  { name: 'mountains', description: 'Towering mountains with rocky peaks.' },
  { name: 'hills', description: 'Rolling hills and gentle slopes.' },
  { name: 'sewers', description: 'Dark, damp sewers beneath the city.' },
  { name: 'caves', description: 'Dark caves winding underground.' },
];

export async function seedBiomes() {
  for (const biome of BIOMES) {
    await prisma.biome.upsert({
      where: { name: biome.name },
      update: {},
      create: biome,
    });
  }
}
