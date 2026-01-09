export declare class PrismaClient {
  $disconnect(): Promise<void>;
}
export declare const Prisma: object;
export declare const PlayerSlot: {
  readonly weapon: 'weapon';
  readonly head: 'head';
  readonly chest: 'chest';
  readonly legs: 'legs';
  readonly feet: 'feet';
};
export declare const ItemType: {
  readonly WEAPON: 'WEAPON';
  readonly ARMOR: 'ARMOR';
};
export declare const ItemQuality: {
  readonly Trash: 'Trash';
  readonly Poor: 'Poor';
  readonly Common: 'Common';
  readonly Uncommon: 'Uncommon';
  readonly Fine: 'Fine';
  readonly Superior: 'Superior';
  readonly Rare: 'Rare';
  readonly Epic: 'Epic';
  readonly Legendary: 'Legendary';
  readonly Mythic: 'Mythic';
  readonly Artifact: 'Artifact';
  readonly Ascended: 'Ascended';
  readonly Transcendent: 'Transcendent';
  readonly Primal: 'Primal';
  readonly Divine: 'Divine';
};
