import { PrismaClient, Prisma } from '@prisma/client';

// Singleton pattern for Prisma client
let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}

// Re-export PrismaClient class and types from Prisma for convenience
export { PrismaClient, Prisma };
export type {
  Player,
  Biome,
  Monster,
  WeatherState,
  GameState,
  Settlement,
  Landmark,
  CombatLog,
} from '@prisma/client';
