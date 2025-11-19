import {
  PrismaClient,
  Prisma,
  ItemQuality,
  PlayerSlot,
  AnnouncementStatus,
  GuildTradeDirection,
  type Player,
  type SlackUser,
  type Monster,
  type Item,
  type WorldItem,
} from '@prisma/client';

// Singleton pattern for Prisma client
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

// Re-export PrismaClient class and types from Prisma for convenience
export {
  PrismaClient,
  Prisma,
  ItemQuality,
  PlayerSlot,
  AnnouncementStatus,
  GuildTradeDirection,
};

export type {
  Player,
  Biome,
  Monster,
  WeatherState,
  GameState,
  Landmark,
  CombatLog,
  Item,
  PlayerItem,
  WorldItem,
  SlackUser,
  GuildHall,
  PlayerGuildState,
  ShopCatalogItem,
  TransactionReceipt,
  AnnouncementRecord,
} from '@prisma/client';

export type { ItemQuality as ItemQualityType } from '@prisma/client';

// Equipment slots mapping
export type PlayerEquipment = {
  [K in PlayerSlot]: { id: number; quality: string } | null;
};

// Common type aliases for cross-service usage
export type PlayerWithSlackUser = Player & {
  slackUser?: SlackUser | null;
};

export type MonsterWithStats = Monster;

export type ItemWithQuality = Item & {
  quality?: ItemQuality;
};

export type WorldItemWithDetails = WorldItem & {
  item?: Item | null;
};
