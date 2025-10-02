import { PrismaClient, Prisma } from '@prisma/client';

// Singleton pattern for Prisma client
// Prisma generates types that can be flagged by strict TypeScript rules
/* eslint-disable @typescript-eslint/no-redundant-type-constituents,  @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
let prisma: PrismaClient | undefined;

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
/* eslint-enable @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

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
