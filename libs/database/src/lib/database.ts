import {
  PrismaClient,
  Prisma,
  type Player as PrismaPlayer,
  type Biome as PrismaBiome,
  type Monster as PrismaMonster,
  type WeatherState as PrismaWeatherState,
  type GameState as PrismaGameState,
  type Settlement as PrismaSettlement,
  type Landmark as PrismaLandmark,
  type CombatLog as PrismaCombatLog,
} from '@prisma/client';

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

export type Player = PrismaPlayer;
export type Biome = PrismaBiome;
export type Monster = PrismaMonster;
export type WeatherState = PrismaWeatherState;
export type GameState = PrismaGameState;
export type Settlement = PrismaSettlement;
export type Landmark = PrismaLandmark;
export type CombatLog = PrismaCombatLog;
