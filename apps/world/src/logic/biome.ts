import prisma from '../prisma';

export const BIOMES = [
  // Existing biomes
  { name: 'forest', description: 'A dense forest with tall trees.' },
  { name: 'village', description: 'A small village with a few houses.' },
  { name: 'city', description: 'A bustling city full of life.' },
  { name: 'desert', description: 'A vast, arid desert.' },
  { name: 'plains', description: 'Open plains with tall grass.' },
  { name: 'mountains', description: 'Towering mountains with rocky peaks.' },
  { name: 'hills', description: 'Rolling hills and gentle slopes.' },
  
  // New biomes for enhanced world generation
  { name: 'ocean', description: 'Deep ocean waters.' },
  { name: 'lake', description: 'A freshwater lake.' },
  { name: 'beach', description: 'Sandy beach along the coastline.' },
  { name: 'tundra', description: 'Frozen tundra with sparse vegetation.' },
  { name: 'taiga', description: 'Coniferous forest of the north.' },
  { name: 'savanna', description: 'Open grassland with scattered trees.' },
  { name: 'jungle', description: 'Dense tropical jungle with exotic wildlife.' },
  { name: 'rainforest', description: 'Lush rainforest teeming with life.' },
  { name: 'swamp', description: 'Murky swampland with twisted trees.' },
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
