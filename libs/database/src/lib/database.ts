import {
  PrismaClient,
  Prisma,
  ItemQuality,
  TicketTier,
  PlayerSlot,
  AnnouncementStatus,
  RunStatus,
  RunType,
  GuildTradeDirection,
  ItemType,
  type Player,
  type GuildShopState,
  type SlackUser,
  type Monster,
  type Item,
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
  TicketTier,
  PlayerSlot,
  AnnouncementStatus,
  RunStatus,
  RunType,
  GuildTradeDirection,
  ItemType,
};

export type {
  Player,
  Guild,
  GuildMember,
  GuildInvite,
  GuildShopState,
  Monster,
  CombatLog,
  Item,
  PlayerItem,
  Run,
  RunParticipant,
  SlackUser,
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
