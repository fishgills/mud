export interface MonsterTemplate {
  name: string;
  type: string; // unique key
  baseHp: number;
  strength: number;
  agility: number;
  health: number;
  damageRoll: string;
  tier: number; // 1-5 difficulty tier (1=trivial, 2=easy, 3=medium, 4=hard, 5=deadly)
}

/**
 * Monster Variants - affects stats and display
 * Probability: 15% Feeble, 70% Normal, 15% Mighty
 */
export type MonsterVariant = 'feeble' | 'normal' | 'mighty';

export const VARIANT_CONFIG: Record<
  MonsterVariant,
  {
    label: string;
    hpMultiplier: number;
    statModifier: number;
    color: string; // Slack mrkdwn color or emoji prefix
  }
> = {
  feeble: {
    label: 'Feeble',
    hpMultiplier: 0.7,
    statModifier: -2,
    color: ':small_blue_diamond:', // Blue for weak
  },
  normal: {
    label: '',
    hpMultiplier: 1.0,
    statModifier: 0,
    color: '',
  },
  mighty: {
    label: 'Mighty',
    hpMultiplier: 1.4,
    statModifier: 3,
    color: ':small_red_triangle:', // Red for dangerous
  },
};

/**
 * Roll a random variant with weighted probability
 */
export function rollVariant(): MonsterVariant {
  const roll = Math.random();
  if (roll < 0.15) return 'feeble';
  if (roll < 0.85) return 'normal';
  return 'mighty';
}

/**
 * Format monster display name with variant
 */
export function formatMonsterName(
  baseName: string,
  variant: MonsterVariant,
): string {
  const config = VARIANT_CONFIG[variant];
  if (!config.label) return baseName;
  return `${config.color} ${config.label} ${baseName}`.trim();
}

/**
 * Get variant from stored monster name (for backwards compatibility)
 */
export function parseVariantFromName(name: string): {
  baseName: string;
  variant: MonsterVariant;
} {
  for (const [variant, config] of Object.entries(VARIANT_CONFIG)) {
    if (config.label && name.includes(config.label)) {
      const baseName = name
        .replace(config.color, '')
        .replace(config.label, '')
        .trim();
      return { baseName, variant: variant as MonsterVariant };
    }
  }
  return { baseName: name, variant: 'normal' };
}

/**
 * Monster Templates - 50 creatures organized by difficulty tier
 *
 * Tier 1 (Trivial): CR 0-1/4 equivalent. Level 1 players can handle easily.
 * Tier 2 (Easy): CR 1/2-1 equivalent. Level 1-3 players.
 * Tier 3 (Medium): CR 2-3 equivalent. Level 3-5 players.
 * Tier 4 (Hard): CR 4-6 equivalent. Level 5-8 players.
 * Tier 5 (Deadly): CR 7+ equivalent. Level 8+ players.
 *
 * Stats are balanced against player stats (4d6k3, avg ~12):
 * - Tier 1: STR 4-8, AGI 8-14, HP 8-20
 * - Tier 2: STR 8-12, AGI 9-14, HP 20-35
 * - Tier 3: STR 12-15, AGI 10-14, HP 35-55
 * - Tier 4: STR 15-18, AGI 8-14, HP 55-85
 * - Tier 5: STR 18-22, AGI 6-12, HP 85-130
 */
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1 - TRIVIAL (Level 1 fodder, HP 8-20)
  // Easy kills for new players, low threat
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Giant Rat',
    type: 'giant-rat',
    baseHp: 8,
    strength: 4,
    agility: 12,
    health: 4,
    damageRoll: '1d4',
    tier: 1,
  },
  {
    name: 'Stirge',
    type: 'stirge',
    baseHp: 6,
    strength: 3,
    agility: 16,
    health: 3,
    damageRoll: '1d4',
    tier: 1,
  },
  {
    name: 'Giant Centipede',
    type: 'giant-centipede',
    baseHp: 8,
    strength: 4,
    agility: 14,
    health: 4,
    damageRoll: '1d4',
    tier: 1,
  },
  {
    name: 'Kobold',
    type: 'kobold',
    baseHp: 12,
    strength: 5,
    agility: 13,
    health: 5,
    damageRoll: '1d4',
    tier: 1,
  },
  {
    name: 'Fire Beetle',
    type: 'fire-beetle',
    baseHp: 10,
    strength: 6,
    agility: 10,
    health: 5,
    damageRoll: '1d4',
    tier: 1,
  },
  {
    name: 'Goblin',
    type: 'goblin',
    baseHp: 14,
    strength: 6,
    agility: 12,
    health: 6,
    damageRoll: '1d6',
    tier: 1,
  },
  {
    name: 'Skeleton',
    type: 'skeleton',
    baseHp: 16,
    strength: 8,
    agility: 10,
    health: 6,
    damageRoll: '1d6',
    tier: 1,
  },
  {
    name: 'Zombie',
    type: 'zombie',
    baseHp: 20,
    strength: 8,
    agility: 4,
    health: 8,
    damageRoll: '1d6',
    tier: 1,
  },
  {
    name: 'Slime',
    type: 'slime',
    baseHp: 18,
    strength: 5,
    agility: 4,
    health: 8,
    damageRoll: '1d4',
    tier: 1,
  },
  {
    name: 'Giant Wasp',
    type: 'giant-wasp',
    baseHp: 14,
    strength: 5,
    agility: 14,
    health: 5,
    damageRoll: '1d6',
    tier: 1,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2 - EASY (Level 1-3, HP 20-35)
  // Standard encounters, fair fight for new players
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Wolf',
    type: 'wolf',
    baseHp: 22,
    strength: 10,
    agility: 14,
    health: 8,
    damageRoll: '1d6',
    tier: 2,
  },
  {
    name: 'Hobgoblin',
    type: 'hobgoblin',
    baseHp: 26,
    strength: 11,
    agility: 10,
    health: 9,
    damageRoll: '1d8',
    tier: 2,
  },
  {
    name: 'Orc',
    type: 'orc',
    baseHp: 28,
    strength: 12,
    agility: 9,
    health: 10,
    damageRoll: '1d10',
    tier: 2,
  },
  {
    name: 'Gnoll',
    type: 'gnoll',
    baseHp: 28,
    strength: 11,
    agility: 10,
    health: 9,
    damageRoll: '1d8',
    tier: 2,
  },
  {
    name: 'Giant Spider',
    type: 'giant-spider',
    baseHp: 26,
    strength: 10,
    agility: 12,
    health: 9,
    damageRoll: '1d8',
    tier: 2,
  },
  {
    name: 'Ghoul',
    type: 'ghoul',
    baseHp: 30,
    strength: 11,
    agility: 12,
    health: 10,
    damageRoll: '1d8',
    tier: 2,
  },
  {
    name: 'Bandit',
    type: 'bandit',
    baseHp: 24,
    strength: 10,
    agility: 12,
    health: 8,
    damageRoll: '1d6',
    tier: 2,
  },
  {
    name: 'Wild Boar',
    type: 'boar',
    baseHp: 28,
    strength: 12,
    agility: 8,
    health: 10,
    damageRoll: '1d8',
    tier: 2,
  },
  {
    name: 'Worg',
    type: 'worg',
    baseHp: 32,
    strength: 12,
    agility: 12,
    health: 10,
    damageRoll: '2d4',
    tier: 2,
  },
  {
    name: 'Lizardfolk',
    type: 'lizardfolk',
    baseHp: 30,
    strength: 12,
    agility: 10,
    health: 10,
    damageRoll: '1d8',
    tier: 2,
  },
  {
    name: 'Harpy',
    type: 'harpy',
    baseHp: 28,
    strength: 9,
    agility: 14,
    health: 8,
    damageRoll: '2d4',
    tier: 2,
  },
  {
    name: 'Fire Sprite',
    type: 'fire-sprite',
    baseHp: 22,
    strength: 8,
    agility: 14,
    health: 7,
    damageRoll: '1d6',
    tier: 2,
  },
  {
    name: 'Ice Wolf',
    type: 'ice-wolf',
    baseHp: 30,
    strength: 11,
    agility: 13,
    health: 10,
    damageRoll: '2d4',
    tier: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3 - MEDIUM (Level 3-5, HP 35-55)
  // Challenging for mid-level players
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Dire Wolf',
    type: 'dire-wolf',
    baseHp: 42,
    strength: 14,
    agility: 13,
    health: 12,
    damageRoll: '2d6',
    tier: 3,
  },
  {
    name: 'Bugbear',
    type: 'bugbear',
    baseHp: 45,
    strength: 14,
    agility: 11,
    health: 12,
    damageRoll: '2d6',
    tier: 3,
  },
  {
    name: 'Black Bear',
    type: 'bear',
    baseHp: 48,
    strength: 15,
    agility: 8,
    health: 13,
    damageRoll: '2d6',
    tier: 3,
  },
  {
    name: 'Wight',
    type: 'wight',
    baseHp: 44,
    strength: 13,
    agility: 10,
    health: 12,
    damageRoll: '1d10',
    tier: 3,
  },
  {
    name: 'Giant Scorpion',
    type: 'giant-scorpion',
    baseHp: 40,
    strength: 13,
    agility: 10,
    health: 11,
    damageRoll: '1d10',
    tier: 3,
  },
  {
    name: 'Ogre',
    type: 'ogre',
    baseHp: 50,
    strength: 16,
    agility: 6,
    health: 14,
    damageRoll: '2d8',
    tier: 3,
  },
  {
    name: 'Crocodile',
    type: 'crocodile',
    baseHp: 45,
    strength: 14,
    agility: 8,
    health: 12,
    damageRoll: '1d10',
    tier: 3,
  },
  {
    name: 'Mimic',
    type: 'mimic',
    baseHp: 44,
    strength: 14,
    agility: 8,
    health: 12,
    damageRoll: '1d10',
    tier: 3,
  },
  {
    name: 'Wraith',
    type: 'wraith',
    baseHp: 40,
    strength: 12,
    agility: 14,
    health: 10,
    damageRoll: '2d6',
    tier: 3,
  },
  {
    name: 'Hell Hound',
    type: 'hell-hound',
    baseHp: 42,
    strength: 14,
    agility: 12,
    health: 11,
    damageRoll: '2d6',
    tier: 3,
  },
  {
    name: 'Jaguar',
    type: 'jaguar',
    baseHp: 38,
    strength: 13,
    agility: 15,
    health: 10,
    damageRoll: '1d8',
    tier: 3,
  },
  {
    name: 'Swamp Hag',
    type: 'swamp-hag',
    baseHp: 48,
    strength: 14,
    agility: 10,
    health: 12,
    damageRoll: '2d6',
    tier: 3,
  },
  {
    name: 'Sand Wraith',
    type: 'sand-wraith',
    baseHp: 40,
    strength: 12,
    agility: 14,
    health: 10,
    damageRoll: '2d6',
    tier: 3,
  },
  {
    name: 'Frost Wight',
    type: 'frost-wight',
    baseHp: 48,
    strength: 13,
    agility: 10,
    health: 12,
    damageRoll: '1d10',
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4 - HARD (Level 5-8, HP 55-85)
  // Dangerous for experienced players
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Troll',
    type: 'troll',
    baseHp: 65,
    strength: 17,
    agility: 8,
    health: 16,
    damageRoll: '2d8',
    tier: 4,
  },
  {
    name: 'Dire Bear',
    type: 'dire-bear',
    baseHp: 70,
    strength: 18,
    agility: 7,
    health: 16,
    damageRoll: '2d8',
    tier: 4,
  },
  {
    name: 'Earth Golem',
    type: 'earth-golem',
    baseHp: 75,
    strength: 18,
    agility: 4,
    health: 18,
    damageRoll: '2d10',
    tier: 4,
  },
  {
    name: 'Wyrmling',
    type: 'wyrmling',
    baseHp: 60,
    strength: 15,
    agility: 12,
    health: 14,
    damageRoll: '2d8',
    tier: 4,
  },
  {
    name: 'Basilisk',
    type: 'basilisk',
    baseHp: 58,
    strength: 15,
    agility: 8,
    health: 14,
    damageRoll: '2d6',
    tier: 4,
  },
  {
    name: 'Giant Python',
    type: 'giant-python',
    baseHp: 55,
    strength: 16,
    agility: 10,
    health: 14,
    damageRoll: '2d6',
    tier: 4,
  },
  {
    name: 'Manticore',
    type: 'manticore',
    baseHp: 62,
    strength: 16,
    agility: 12,
    health: 14,
    damageRoll: '2d8',
    tier: 4,
  },
  {
    name: 'Owlbear',
    type: 'owlbear',
    baseHp: 58,
    strength: 17,
    agility: 10,
    health: 14,
    damageRoll: '2d8',
    tier: 4,
  },
  {
    name: 'Mummy Lord',
    type: 'mummy-lord',
    baseHp: 65,
    strength: 16,
    agility: 8,
    health: 16,
    damageRoll: '2d8',
    tier: 4,
  },
  {
    name: 'Wyvern',
    type: 'wyvern',
    baseHp: 68,
    strength: 17,
    agility: 12,
    health: 15,
    damageRoll: '2d8',
    tier: 4,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 5 - DEADLY (Level 8+, HP 85-130)
  // Boss-level threats, very dangerous
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Hill Giant',
    type: 'hill-giant',
    baseHp: 95,
    strength: 20,
    agility: 6,
    health: 18,
    damageRoll: '3d8',
    tier: 5,
  },
  {
    name: 'Frost Giant',
    type: 'frost-giant',
    baseHp: 110,
    strength: 21,
    agility: 6,
    health: 20,
    damageRoll: '3d10',
    tier: 5,
  },
  {
    name: 'Drake',
    type: 'drake',
    baseHp: 90,
    strength: 19,
    agility: 10,
    health: 18,
    damageRoll: '3d8',
    tier: 5,
  },
  {
    name: 'Chimera',
    type: 'chimera',
    baseHp: 100,
    strength: 18,
    agility: 10,
    health: 18,
    damageRoll: '3d8',
    tier: 5,
  },
  {
    name: 'Hydra',
    type: 'hydra',
    baseHp: 120,
    strength: 19,
    agility: 8,
    health: 20,
    damageRoll: '3d10',
    tier: 5,
  },
  {
    name: 'Lich',
    type: 'lich',
    baseHp: 85,
    strength: 12,
    agility: 12,
    health: 16,
    damageRoll: '4d6',
    tier: 5,
  },
  {
    name: 'Death Knight',
    type: 'death-knight',
    baseHp: 100,
    strength: 20,
    agility: 10,
    health: 18,
    damageRoll: '3d8',
    tier: 5,
  },
];

// Quick lookup by type
export const MONSTER_TEMPLATE_BY_TYPE: Record<string, MonsterTemplate> =
  Object.fromEntries(MONSTER_TEMPLATES.map((t) => [t.type, t]));

export function getMonsterTemplate(type: string): MonsterTemplate {
  return MONSTER_TEMPLATE_BY_TYPE[type] ?? MONSTER_TEMPLATE_BY_TYPE['goblin'];
}

/**
 * Get monsters by tier for spawning decisions
 */
export function getMonstersByTier(tier: number): MonsterTemplate[] {
  return MONSTER_TEMPLATES.filter((m) => m.tier === tier);
}

/**
 * Get appropriate tier for player level
 */
export function getTierForLevel(level: number): number {
  if (level <= 1) return 1;
  if (level <= 3) return 2;
  if (level <= 5) return 3;
  if (level <= 8) return 4;
  return 5;
}

// ═══════════════════════════════════════════════════════════════════════════
// Biome Spawn Tables - legacy weighted monster spawning by biome
// ═══════════════════════════════════════════════════════════════════════════
export const BIOME_SPAWN_TABLE: Record<
  string,
  Array<{ type: string; w: number }>
> = {
  grassland: [
    { type: 'giant-rat', w: 3 },
    { type: 'goblin', w: 3 },
    { type: 'wolf', w: 2 },
    { type: 'boar', w: 2 },
    { type: 'bandit', w: 2 },
    { type: 'giant-wasp', w: 1 },
  ],
  plains: [
    { type: 'goblin', w: 3 },
    { type: 'wolf', w: 3 },
    { type: 'gnoll', w: 2 },
    { type: 'bandit', w: 2 },
    { type: 'worg', w: 1 },
  ],
  forest: [
    { type: 'wolf', w: 3 },
    { type: 'goblin', w: 2 },
    { type: 'giant-spider', w: 2 },
    { type: 'kobold', w: 2 },
    { type: 'bear', w: 1 },
    { type: 'hobgoblin', w: 1 },
    { type: 'bugbear', w: 1 },
    { type: 'dire-wolf', w: 1 },
  ],
  taiga: [
    { type: 'wolf', w: 3 },
    { type: 'ice-wolf', w: 2 },
    { type: 'frost-wight', w: 1 },
    { type: 'bear', w: 1 },
    { type: 'dire-bear', w: 1 },
  ],
  tundra: [
    { type: 'ice-wolf', w: 3 },
    { type: 'frost-wight', w: 2 },
    { type: 'skeleton', w: 2 },
    { type: 'zombie', w: 1 },
    { type: 'wraith', w: 1 },
    { type: 'frost-giant', w: 1 },
  ],
  mountain: [
    { type: 'harpy', w: 3 },
    { type: 'skeleton', w: 2 },
    { type: 'gnoll', w: 2 },
    { type: 'ogre', w: 1 },
    { type: 'wyvern', w: 1 },
    { type: 'troll', w: 1 },
    { type: 'hill-giant', w: 1 },
  ],
  mountains: [
    { type: 'harpy', w: 3 },
    { type: 'skeleton', w: 2 },
    { type: 'earth-golem', w: 1 },
    { type: 'wyvern', w: 1 },
    { type: 'drake', w: 1 },
  ],
  desert: [
    { type: 'giant-scorpion', w: 3 },
    { type: 'sand-wraith', w: 2 },
    { type: 'skeleton', w: 2 },
    { type: 'basilisk', w: 1 },
    { type: 'giant-centipede', w: 1 },
    { type: 'mummy-lord', w: 1 },
  ],
  swamp: [
    { type: 'lizardfolk', w: 3 },
    { type: 'crocodile', w: 2 },
    { type: 'slime', w: 2 },
    { type: 'ghoul', w: 1 },
    { type: 'swamp-hag', w: 1 },
    { type: 'giant-python', w: 1 },
  ],
  marsh: [
    { type: 'lizardfolk', w: 3 },
    { type: 'crocodile', w: 2 },
    { type: 'slime', w: 2 },
    { type: 'giant-rat', w: 1 },
  ],
  jungle: [
    { type: 'jaguar', w: 3 },
    { type: 'giant-spider', w: 2 },
    { type: 'giant-python', w: 2 },
    { type: 'kobold', w: 1 },
    { type: 'giant-centipede', w: 1 },
    { type: 'basilisk', w: 1 },
  ],
  savanna: [
    { type: 'gnoll', w: 3 },
    { type: 'wolf', w: 2 },
    { type: 'boar', w: 2 },
    { type: 'bandit', w: 1 },
    { type: 'worg', w: 1 },
  ],
  hills: [
    { type: 'goblin', w: 3 },
    { type: 'hobgoblin', w: 2 },
    { type: 'wolf', w: 2 },
    { type: 'bugbear', w: 1 },
    { type: 'ogre', w: 1 },
    { type: 'hill-giant', w: 1 },
  ],
  beach: [
    { type: 'bandit', w: 2 },
    { type: 'giant-rat', w: 2 },
    { type: 'crocodile', w: 1 },
  ],
  alpine: [
    { type: 'harpy', w: 3 },
    { type: 'ice-wolf', w: 2 },
    { type: 'ogre', w: 1 },
    { type: 'frost-wight', w: 1 },
  ],
  volcanic: [
    { type: 'fire-sprite', w: 3 },
    { type: 'hell-hound', w: 2 },
    { type: 'fire-beetle', w: 2 },
    { type: 'earth-golem', w: 1 },
    { type: 'drake', w: 1 },
    { type: 'chimera', w: 1 },
  ],
};

export function pickTypeForBiome(biomeName: string): string {
  const key = biomeName?.toLowerCase();
  const table = BIOME_SPAWN_TABLE[key];
  if (!table || table.length === 0) {
    // default/fallback pool for unknown biomes
    const fallback = [
      { type: 'goblin', w: 3 },
      { type: 'wolf', w: 2 },
      { type: 'skeleton', w: 1 },
      { type: 'slime', w: 1 },
    ];
    const totalF = fallback.reduce((s, r) => s + r.w, 0);
    let rndF = Math.random() * totalF;
    for (const row of fallback) {
      if ((rndF -= row.w) <= 0) return row.type;
    }
    return fallback[0].type;
  }

  const total = table.reduce((s, r) => s + r.w, 0);
  let rnd = Math.random() * total;
  for (const row of table) {
    if ((rnd -= row.w) <= 0) return row.type;
  }
  return table[0].type;
}
