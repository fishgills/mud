import { ItemQuality, ItemType, PlayerSlot, TicketTier } from '@mud/database';

export type ShopOffset = -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4;

export type ShopArchetype = 'Offense' | 'Evasion' | 'Tank' | 'Balanced';

export type GeneratedShopListing = {
  name: string;
  description: string;
  slot: PlayerSlot;
  itemType: ItemType;
  tier: number;
  offsetK: ShopOffset;
  itemPower: number;
  strengthBonus: number;
  agilityBonus: number;
  healthBonus: number;
  weaponDiceCount: number | null;
  weaponDiceSides: number | null;
  priceGold: number;
  stockQuantity: number;
  quality: ItemQuality;
  tags: string[];
  archetype: ShopArchetype;
  ticketRequirement: TicketTier | null;
};

const SLOT_WEIGHTS: Record<PlayerSlot, number> = {
  [PlayerSlot.weapon]: 1.0,
  [PlayerSlot.chest]: 0.85,
  [PlayerSlot.legs]: 0.65,
  [PlayerSlot.arms]: 0.55,
  [PlayerSlot.head]: 0.45,
};

const SLOT_PRICE_MULTIPLIERS: Record<PlayerSlot, number> = {
  [PlayerSlot.weapon]: 1.3,
  [PlayerSlot.chest]: 1.1,
  [PlayerSlot.legs]: 1.0,
  [PlayerSlot.arms]: 0.9,
  [PlayerSlot.head]: 0.85,
};

const SLOT_LABELS: Record<PlayerSlot, string> = {
  [PlayerSlot.weapon]: 'Blade',
  [PlayerSlot.chest]: 'Chestpiece',
  [PlayerSlot.legs]: 'Legguards',
  [PlayerSlot.arms]: 'Armguards',
  [PlayerSlot.head]: 'Helm',
};

const ARCHETYPE_LABELS: Record<ShopArchetype, string> = {
  Offense: 'Fierce',
  Evasion: 'Swift',
  Tank: 'Stalwart',
  Balanced: 'Tempered',
};

const VARIANT_SUFFIXES = [
  'Prime',
  'Echo',
  'Nova',
  'Vanguard',
  'Apex',
  'Ember',
  'Rune',
  'Gale',
];

const ARCHETYPE_WEIGHTS: Record<
  ShopArchetype,
  { strength: number; agility: number; health: number }
> = {
  Offense: { strength: 0.7, agility: 0.3, health: 0.0 },
  Evasion: { strength: 0.0, agility: 0.7, health: 0.3 },
  Tank: { strength: 0.0, agility: 0.3, health: 0.7 },
  Balanced: { strength: 0.4, agility: 0.3, health: 0.3 },
};

const OFFSETS: ShopOffset[] = [-3, -2, -1, 0, 1, 2, 3, 4];

const WEAPON_DICE_LADDER: Array<{
  minTier: number;
  count: number;
  sides: number;
}> = [
  { minTier: 1, count: 1, sides: 6 },
  { minTier: 3, count: 1, sides: 8 },
  { minTier: 6, count: 1, sides: 10 },
  { minTier: 10, count: 1, sides: 12 },
  { minTier: 15, count: 2, sides: 6 },
  { minTier: 22, count: 2, sides: 8 },
  { minTier: 30, count: 2, sides: 10 },
  { minTier: 40, count: 3, sides: 8 },
  { minTier: 55, count: 3, sides: 10 },
  { minTier: 75, count: 4, sides: 10 },
  { minTier: 100, count: 4, sides: 10 },
];

const SHOP_LAYOUT: PlayerSlot[] = [
  PlayerSlot.weapon,
  PlayerSlot.weapon,
  PlayerSlot.chest,
  PlayerSlot.chest,
  PlayerSlot.legs,
  PlayerSlot.legs,
  PlayerSlot.arms,
  PlayerSlot.arms,
  PlayerSlot.head,
  PlayerSlot.head,
];

const OFFSET_WEIGHTING = {
  higherTierDecay: 0.45,
  lowerTierBias: 0.8,
};

const STOCK_BASE = 6;
const STOCK_DECAY = 1.6;
const PRICE_COEFFICIENT = 2;
const PRICE_EXPONENT = 1.6;
const CHASE_OFFSET = 4;

const offsetWeights = OFFSETS.map((offset) => {
  if (offset >= 0) {
    return Math.pow(OFFSET_WEIGHTING.higherTierDecay, offset);
  }
  return Math.pow(OFFSET_WEIGHTING.lowerTierBias, -offset);
});

const offsetWeightTotal = offsetWeights.reduce((sum, value) => sum + value, 0);

const sampleOffset = (rng: () => number): ShopOffset => {
  let roll = rng() * offsetWeightTotal;
  for (let i = 0; i < OFFSETS.length; i += 1) {
    roll -= offsetWeights[i];
    if (roll <= 0) {
      return OFFSETS[i];
    }
  }
  return OFFSETS[OFFSETS.length - 1];
};

export const computeGlobalTier = (medianLevel: number): number => {
  const safe = Math.max(1, Math.floor(medianLevel));
  return safe;
};

export const computeItemPower = (tier: number, slot: PlayerSlot): number => {
  const base = Math.floor(10 * Math.sqrt(Math.max(1, tier)));
  const weight = SLOT_WEIGHTS[slot] ?? 1;
  return Math.max(1, Math.round(base * weight));
};

export const computeStatBonuses = (
  itemPower: number,
  archetype: ShopArchetype,
): { strengthBonus: number; agilityBonus: number; healthBonus: number } => {
  const weights = ARCHETYPE_WEIGHTS[archetype];
  const budget = Math.max(1, Math.floor(itemPower));
  const strengthBonus = Math.floor(budget * weights.strength);
  const agilityBonus = Math.floor(budget * weights.agility);
  const healthBonus = budget - strengthBonus - agilityBonus;
  return {
    strengthBonus,
    agilityBonus,
    healthBonus,
  };
};

export const resolveWeaponDice = (
  tier: number,
): { count: number; sides: number } => {
  const clamped = Math.max(1, Math.floor(tier));
  let chosen = WEAPON_DICE_LADDER[0];
  for (const step of WEAPON_DICE_LADDER) {
    if (clamped >= step.minTier) {
      chosen = step;
    } else {
      break;
    }
  }

  if (clamped <= WEAPON_DICE_LADDER[WEAPON_DICE_LADDER.length - 1].minTier) {
    return { count: chosen.count, sides: chosen.sides };
  }

  const beyond =
    clamped - WEAPON_DICE_LADDER[WEAPON_DICE_LADDER.length - 1].minTier;
  const steps = Math.floor(beyond / 25);
  let count = chosen.count;
  let sides = chosen.sides;
  for (let i = 0; i < steps; i += 1) {
    if (sides < 12) {
      sides = Math.min(12, sides + 2);
    } else {
      count += 1;
      sides = 10;
    }
  }
  return { count, sides };
};

export const formatWeaponRoll = (count: number, sides: number): string =>
  `${count}d${sides}`;

export const computePrice = (itemPower: number, slot: PlayerSlot): number => {
  const base =
    PRICE_COEFFICIENT * Math.pow(Math.max(1, itemPower), PRICE_EXPONENT);
  const multiplier = SLOT_PRICE_MULTIPLIERS[slot] ?? 1;
  return Math.max(1, Math.round(base * multiplier));
};

export const computeStockForOffset = (offset: ShopOffset): number => {
  const scaled = STOCK_BASE * Math.pow(STOCK_DECAY, -offset);
  return Math.max(1, Math.round(scaled));
};

export const resolveTicketRequirement = (
  offset: ShopOffset,
): TicketTier | null => {
  if (offset <= 1) return null;
  if (offset === 2) return TicketTier.Epic;
  return TicketTier.Legendary;
};

export const resolveQualityForOffset = (offset: ShopOffset): ItemQuality => {
  if (offset <= 0) return ItemQuality.Common;
  if (offset === 1) return ItemQuality.Uncommon;
  if (offset === 2) return ItemQuality.Rare;
  if (offset === 3) return ItemQuality.Epic;
  return ItemQuality.Legendary;
};

const rollArchetype = (rng: () => number): ShopArchetype => {
  const roll = rng();
  if (roll < 0.25) return 'Offense';
  if (roll < 0.5) return 'Evasion';
  if (roll < 0.75) return 'Tank';
  return 'Balanced';
};

const buildListingBaseName = (
  slot: PlayerSlot,
  archetype: ShopArchetype,
): string => {
  const label = SLOT_LABELS[slot];
  const archetypeLabel = ARCHETYPE_LABELS[archetype];
  return `${archetypeLabel} ${label}`;
};

const applyVariantSuffix = (name: string, variantIndex: number): string => {
  if (variantIndex === 0) return name;
  const suffix = VARIANT_SUFFIXES[variantIndex - 1];
  if (suffix) return `${name} ${suffix}`;
  return `${name} Variant ${variantIndex + 1}`;
};

const buildListingDescription = (slot: PlayerSlot): string => {
  const label = SLOT_LABELS[slot].toLowerCase();
  return `${label} tuned for guild expeditions.`;
};

export const generateShopListings = (params: {
  globalTier: number;
  forceChase: boolean;
  rng?: () => number;
}): GeneratedShopListing[] => {
  const rng = params.rng ?? Math.random;
  const globalTier = Math.max(1, Math.floor(params.globalTier));
  const slots = [...SHOP_LAYOUT];
  const offsets = slots.map(() => sampleOffset(rng));

  if (params.forceChase) {
    const chaseIndex = Math.floor(rng() * offsets.length);
    offsets[chaseIndex] = CHASE_OFFSET;
  }

  const drafts = slots.map((slot, index) => {
    const offsetK = offsets[index];
    const tier = Math.max(1, globalTier + offsetK);
    const archetype = rollArchetype(rng);
    const itemPower = computeItemPower(tier, slot);
    const bonuses = computeStatBonuses(itemPower, archetype);
    const isWeapon = slot === PlayerSlot.weapon;
    const weaponDice = isWeapon ? resolveWeaponDice(tier) : null;
    const priceGold = computePrice(itemPower, slot);
    const stockQuantity = computeStockForOffset(offsetK);
    const ticketRequirement = resolveTicketRequirement(offsetK);
    const quality = resolveQualityForOffset(offsetK);
    const tags = [`tier:${tier}`, `slot:${slot}`];
    const baseName = buildListingBaseName(slot, archetype);

    return {
      baseName,
      description: buildListingDescription(slot),
      slot,
      itemType: isWeapon ? ItemType.WEAPON : ItemType.ARMOR,
      tier,
      offsetK,
      itemPower,
      strengthBonus: bonuses.strengthBonus,
      agilityBonus: bonuses.agilityBonus,
      healthBonus: bonuses.healthBonus,
      weaponDiceCount: weaponDice?.count ?? null,
      weaponDiceSides: weaponDice?.sides ?? null,
      priceGold,
      stockQuantity,
      quality,
      tags,
      archetype,
      ticketRequirement,
    };
  });

  const nameTotals = new Map<string, number>();
  for (const draft of drafts) {
    nameTotals.set(draft.baseName, (nameTotals.get(draft.baseName) ?? 0) + 1);
  }

  const nameIndexes = new Map<string, number>();
  return drafts.map(({ baseName, ...listing }) => {
    const total = nameTotals.get(baseName) ?? 1;
    const index = nameIndexes.get(baseName) ?? 0;
    nameIndexes.set(baseName, index + 1);
    const name = total > 1 ? applyVariantSuffix(baseName, index) : baseName;

    return {
      ...listing,
      name,
    };
  });
};

export const hasChaseItem = (listings: GeneratedShopListing[]): boolean =>
  listings.some((listing) => listing.offsetK >= CHASE_OFFSET);
