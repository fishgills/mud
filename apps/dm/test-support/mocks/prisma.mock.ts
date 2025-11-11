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
