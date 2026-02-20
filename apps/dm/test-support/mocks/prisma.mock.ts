export class PrismaClient {
  $disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

export const Prisma = {};

export const PlayerSlot = {
  weapon: 'weapon',
  head: 'head',
  chest: 'chest',
  legs: 'legs',
  feet: 'feet',
} as const;

export const ItemType = {
  WEAPON: 'WEAPON',
  ARMOR: 'ARMOR',
} as const;

export const ItemQuality = {
  Trash: 'Trash',
  Poor: 'Poor',
  Common: 'Common',
  Uncommon: 'Uncommon',
  Fine: 'Fine',
  Superior: 'Superior',
  Rare: 'Rare',
  Epic: 'Epic',
  Legendary: 'Legendary',
  Mythic: 'Mythic',
  Artifact: 'Artifact',
  Ascended: 'Ascended',
  Transcendent: 'Transcendent',
  Primal: 'Primal',
  Divine: 'Divine',
} as const;

export const TicketTier = {
  Rare: 'Rare',
  Epic: 'Epic',
  Legendary: 'Legendary',
} as const;

export const AnnouncementStatus = {
  PENDING: 'PENDING',
  ANNOUNCED: 'ANNOUNCED',
  EXPIRED: 'EXPIRED',
} as const;

export const RunType = {
  SOLO: 'SOLO',
  GUILD: 'GUILD',
} as const;

export const RunStatus = {
  ACTIVE: 'ACTIVE',
  CASHED_OUT: 'CASHED_OUT',
  FAILED: 'FAILED',
} as const;

export const GuildTradeDirection = {
  BUY: 'BUY',
  SELL: 'SELL',
} as const;

export const AchievementCategory = {
  RAID: 'RAID',
  COMBAT: 'COMBAT',
  ECONOMY: 'ECONOMY',
  SOCIAL: 'SOCIAL',
  GUILD: 'GUILD',
  SEASONAL: 'SEASONAL',
  SECRET: 'SECRET',
} as const;

export const AchievementScope = {
  PLAYER: 'PLAYER',
  GUILD: 'GUILD',
  SEASON: 'SEASON',
} as const;

export const AchievementRewardType = {
  NONE: 'NONE',
  TITLE: 'TITLE',
  BADGE: 'BADGE',
  TICKET: 'TICKET',
  COSMETIC: 'COSMETIC',
} as const;

export const AchievementConditionType = {
  THRESHOLD: 'THRESHOLD',
  STREAK: 'STREAK',
  RECORD: 'RECORD',
  EVENT: 'EVENT',
} as const;
