export interface MonsterTemplate {
  name: string;
  type: string; // unique key
  baseHp: number;
  strength: number;
  agility: number;
  health: number;
  damageRoll: string;
  difficulty: number; // 1-10 scale for difficulty scaling
}

// Monster variant system - fantasy-themed names for weak/normal/strong variants
export enum MonsterVariant {
  FEEBLE = 'feeble', // Weak variant
  NORMAL = 'normal', // Default variant (no label shown)
  FIERCE = 'fierce', // Strong variant
}

export interface MonsterVariantConfig {
  variant: MonsterVariant;
  label: string; // Display label (empty for normal)
  statMultiplier: number; // Multiplier for baseHp, strength, agility, health
  xpMultiplier: number; // XP reward multiplier, reserved for future XP calculation logic
}

export const VARIANT_CONFIGS: Record<MonsterVariant, MonsterVariantConfig> = {
  [MonsterVariant.FEEBLE]: {
    variant: MonsterVariant.FEEBLE,
    label: 'Feeble',
    statMultiplier: 0.7,
    xpMultiplier: 0.6,
  },
  [MonsterVariant.NORMAL]: {
    variant: MonsterVariant.NORMAL,
    label: '',
    statMultiplier: 1.0,
    xpMultiplier: 1.0,
  },
  [MonsterVariant.FIERCE]: {
    variant: MonsterVariant.FIERCE,
    label: 'Fierce',
    statMultiplier: 1.4,
    xpMultiplier: 1.5,
  },
};

// Determine variant based on random roll with weighted probabilities
export function rollMonsterVariant(): MonsterVariant {
  const roll = Math.random();
  if (roll < 0.15) return MonsterVariant.FEEBLE; // 15% chance
  if (roll > 0.85) return MonsterVariant.FIERCE; // 15% chance
  return MonsterVariant.NORMAL; // 70% chance
}

// Get display name for a monster with variant
export function getMonsterDisplayName(
  baseName: string,
  variant: MonsterVariant,
): string {
  const config = VARIANT_CONFIGS[variant];
  if (!config.label) return baseName;
  return `${config.label} ${baseName}`;
}

// Format monster name with optional color coding for Slack mrkdwn
export function formatMonsterNameWithVariant(
  baseName: string,
  variant: MonsterVariant,
  options?: { useColor?: boolean },
): string {
  const config = VARIANT_CONFIGS[variant];
  if (!config.label) return baseName;

  const displayName = `${config.label} ${baseName}`;
  if (!options?.useColor) return displayName;

  // Use Slack mrkdwn formatting for emphasis
  if (variant === MonsterVariant.FEEBLE) {
    return `_${displayName}_`; // Italics for weak
  }
  if (variant === MonsterVariant.FIERCE) {
    return `*${displayName}*`; // Bold for strong
  }
  return displayName;
}

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  // === TIER 1: Trivial (difficulty 1-2) - Very weak creatures for beginners ===
  {
    name: 'Rat',
    type: 'rat',
    baseHp: 8,
    strength: 3,
    agility: 14,
    health: 3,
    damageRoll: '1d2',
    difficulty: 1,
  },
  {
    name: 'Stirge',
    type: 'stirge',
    baseHp: 10,
    strength: 4,
    agility: 16,
    health: 3,
    damageRoll: '1d3',
    difficulty: 1,
  },
  {
    name: 'Giant Centipede',
    type: 'giant-centipede',
    baseHp: 12,
    strength: 4,
    agility: 14,
    health: 4,
    damageRoll: '1d3',
    difficulty: 1,
  },
  {
    name: 'Kobold',
    type: 'kobold',
    baseHp: 18,
    strength: 5,
    agility: 13,
    health: 5,
    damageRoll: '1d4',
    difficulty: 2,
  },
  {
    name: 'Giant Bat',
    type: 'giant-bat',
    baseHp: 16,
    strength: 5,
    agility: 15,
    health: 4,
    damageRoll: '1d4',
    difficulty: 2,
  },

  // === TIER 2: Easy (difficulty 3-4) - Common weak enemies ===
  {
    name: 'Goblin',
    type: 'goblin',
    baseHp: 25,
    strength: 6,
    agility: 12,
    health: 6,
    damageRoll: '1d6',
    difficulty: 3,
  },
  {
    name: 'Skeleton',
    type: 'skeleton',
    baseHp: 20,
    strength: 8,
    agility: 10,
    health: 6,
    damageRoll: '1d6',
    difficulty: 3,
  },
  {
    name: 'Fire Sprite',
    type: 'fire-sprite',
    baseHp: 22,
    strength: 7,
    agility: 14,
    health: 6,
    damageRoll: '1d4',
    difficulty: 3,
  },
  {
    name: 'Water Wisp',
    type: 'water-wisp',
    baseHp: 22,
    strength: 6,
    agility: 13,
    health: 7,
    damageRoll: '1d4',
    difficulty: 3,
  },
  {
    name: 'Air Mote',
    type: 'air-mote',
    baseHp: 20,
    strength: 5,
    agility: 16,
    health: 6,
    damageRoll: '1d4',
    difficulty: 3,
  },
  {
    name: 'Giant Wasp',
    type: 'giant-wasp',
    baseHp: 24,
    strength: 7,
    agility: 15,
    health: 6,
    damageRoll: '1d6',
    difficulty: 3,
  },
  {
    name: 'Cultist',
    type: 'cultist',
    baseHp: 26,
    strength: 7,
    agility: 9,
    health: 9,
    damageRoll: '1d4',
    difficulty: 3,
  },
  {
    name: 'Imp',
    type: 'imp',
    baseHp: 20,
    strength: 6,
    agility: 15,
    health: 5,
    damageRoll: '1d4',
    difficulty: 3,
  },
  {
    name: 'Bandit',
    type: 'bandit',
    baseHp: 28,
    strength: 9,
    agility: 11,
    health: 8,
    damageRoll: '1d6',
    difficulty: 4,
  },
  {
    name: 'Slime',
    type: 'slime',
    baseHp: 28,
    strength: 7,
    agility: 6,
    health: 12,
    damageRoll: '1d6',
    difficulty: 4,
  },

  // === TIER 3: Medium (difficulty 5-6) - Standard combat encounters ===
  {
    name: 'Wolf',
    type: 'wolf',
    baseHp: 30,
    strength: 10,
    agility: 14,
    health: 8,
    damageRoll: '2d4',
    difficulty: 5,
  },
  {
    name: 'Ghoul',
    type: 'ghoul',
    baseHp: 32,
    strength: 9,
    agility: 12,
    health: 9,
    damageRoll: '2d4',
    difficulty: 5,
  },
  {
    name: 'Hobgoblin',
    type: 'hobgoblin',
    baseHp: 32,
    strength: 10,
    agility: 10,
    health: 8,
    damageRoll: '1d8',
    difficulty: 5,
  },
  {
    name: 'Harpy',
    type: 'harpy',
    baseHp: 33,
    strength: 9,
    agility: 14,
    health: 8,
    damageRoll: '2d4',
    difficulty: 5,
  },
  {
    name: 'Ice Wolf',
    type: 'ice-wolf',
    baseHp: 34,
    strength: 11,
    agility: 13,
    health: 10,
    damageRoll: '2d4',
    difficulty: 5,
  },
  {
    name: 'Wild Boar',
    type: 'boar',
    baseHp: 34,
    strength: 12,
    agility: 7,
    health: 10,
    damageRoll: '1d8',
    difficulty: 5,
  },
  {
    name: 'Dune Stalker',
    type: 'dune-stalker',
    baseHp: 34,
    strength: 10,
    agility: 14,
    health: 9,
    damageRoll: '1d6',
    difficulty: 5,
  },
  {
    name: 'Zombie',
    type: 'zombie',
    baseHp: 34,
    strength: 10,
    agility: 4,
    health: 12,
    damageRoll: '1d6',
    difficulty: 5,
  },
  {
    name: 'Shadow Hound',
    type: 'shadow-hound',
    baseHp: 32,
    strength: 10,
    agility: 15,
    health: 8,
    damageRoll: '1d8',
    difficulty: 5,
  },
  {
    name: 'Gnoll',
    type: 'gnoll',
    baseHp: 35,
    strength: 11,
    agility: 9,
    health: 9,
    damageRoll: '1d8',
    difficulty: 5,
  },
  {
    name: 'Ooze',
    type: 'ooze',
    baseHp: 36,
    strength: 9,
    agility: 5,
    health: 13,
    damageRoll: '2d6',
    difficulty: 5,
  },
  {
    name: 'Giant Spider',
    type: 'giant-spider',
    baseHp: 36,
    strength: 10,
    agility: 12,
    health: 9,
    damageRoll: '1d8',
    difficulty: 5,
  },
  {
    name: 'Jaguar',
    type: 'jaguar',
    baseHp: 36,
    strength: 12,
    agility: 15,
    health: 9,
    damageRoll: '1d8',
    difficulty: 5,
  },
  {
    name: 'Wererat',
    type: 'wererat',
    baseHp: 34,
    strength: 10,
    agility: 14,
    health: 9,
    damageRoll: '1d6',
    difficulty: 5,
  },
  {
    name: 'Lizardfolk',
    type: 'lizardfolk',
    baseHp: 38,
    strength: 12,
    agility: 9,
    health: 11,
    damageRoll: '1d6',
    difficulty: 6,
  },
  {
    name: 'Sand Wraith',
    type: 'sand-wraith',
    baseHp: 38,
    strength: 11,
    agility: 13,
    health: 10,
    damageRoll: '1d8',
    difficulty: 6,
  },
  {
    name: 'Orc',
    type: 'orc',
    baseHp: 40,
    strength: 12,
    agility: 8,
    health: 10,
    damageRoll: '1d12',
    difficulty: 6,
  },
  {
    name: 'Giant Scorpion',
    type: 'giant-scorpion',
    baseHp: 42,
    strength: 12,
    agility: 10,
    health: 11,
    damageRoll: '1d10',
    difficulty: 6,
  },
  {
    name: 'Spectral Knight',
    type: 'spectral-knight',
    baseHp: 40,
    strength: 13,
    agility: 10,
    health: 10,
    damageRoll: '1d10',
    difficulty: 6,
  },

  // === TIER 4: Hard (difficulty 7-8) - Challenging encounters ===
  {
    name: 'Mimic',
    type: 'mimic',
    baseHp: 44,
    strength: 13,
    agility: 6,
    health: 12,
    damageRoll: '1d8',
    difficulty: 7,
  },
  {
    name: 'Dire Wolf',
    type: 'dire-wolf',
    baseHp: 44,
    strength: 13,
    agility: 13,
    health: 10,
    damageRoll: '2d6',
    difficulty: 7,
  },
  {
    name: 'Wight',
    type: 'wight',
    baseHp: 46,
    strength: 12,
    agility: 10,
    health: 12,
    damageRoll: '1d8',
    difficulty: 7,
  },
  {
    name: 'Frost Wight',
    type: 'frost-wight',
    baseHp: 48,
    strength: 13,
    agility: 10,
    health: 12,
    damageRoll: '1d8',
    difficulty: 7,
  },
  {
    name: 'Crocodile',
    type: 'crocodile',
    baseHp: 50,
    strength: 15,
    agility: 6,
    health: 12,
    damageRoll: '1d10',
    difficulty: 7,
  },
  {
    name: 'Giant Python',
    type: 'giant-python',
    baseHp: 50,
    strength: 16,
    agility: 7,
    health: 12,
    damageRoll: '2d6',
    difficulty: 7,
  },
  {
    name: 'Swamp Hag',
    type: 'swamp-hag',
    baseHp: 52,
    strength: 14,
    agility: 8,
    health: 12,
    damageRoll: '2d6',
    difficulty: 7,
  },
  {
    name: 'Ogre',
    type: 'ogre',
    baseHp: 55,
    strength: 17,
    agility: 5,
    health: 13,
    damageRoll: '2d8',
    difficulty: 8,
  },
  {
    name: 'Troll',
    type: 'troll',
    baseHp: 58,
    strength: 16,
    agility: 8,
    health: 14,
    damageRoll: '2d6',
    difficulty: 8,
  },

  // === TIER 5: Deadly (difficulty 9-10) - Elite and boss creatures ===
  {
    name: 'Black Bear',
    type: 'bear',
    baseHp: 60,
    strength: 16,
    agility: 6,
    health: 14,
    damageRoll: '2d6',
    difficulty: 9,
  },
  {
    name: 'Wraith',
    type: 'wraith',
    baseHp: 62,
    strength: 14,
    agility: 14,
    health: 13,
    damageRoll: '2d8',
    difficulty: 9,
  },
  {
    name: 'Basilisk',
    type: 'basilisk',
    baseHp: 65,
    strength: 15,
    agility: 6,
    health: 15,
    damageRoll: '2d8',
    difficulty: 9,
  },
  {
    name: 'Earth Golem',
    type: 'earth-golem',
    baseHp: 70,
    strength: 18,
    agility: 4,
    health: 16,
    damageRoll: '2d8',
    difficulty: 9,
  },
  {
    name: 'Manticore',
    type: 'manticore',
    baseHp: 72,
    strength: 17,
    agility: 12,
    health: 14,
    damageRoll: '2d10',
    difficulty: 9,
  },
  {
    name: 'Chimera',
    type: 'chimera',
    baseHp: 80,
    strength: 18,
    agility: 10,
    health: 16,
    damageRoll: '2d10',
    difficulty: 10,
  },
  {
    name: 'Wyvern',
    type: 'wyvern',
    baseHp: 85,
    strength: 19,
    agility: 14,
    health: 15,
    damageRoll: '2d12',
    difficulty: 10,
  },
];

// Quick lookup by type
export const MONSTER_TEMPLATE_BY_TYPE: Record<string, MonsterTemplate> =
  Object.fromEntries(MONSTER_TEMPLATES.map((t) => [t.type, t]));

export function getMonsterTemplate(type: string): MonsterTemplate {
  return MONSTER_TEMPLATE_BY_TYPE[type] ?? MONSTER_TEMPLATE_BY_TYPE['goblin'];
}

// Biome spawn tables - now includes new monsters with varied difficulties
export const BIOME_SPAWN_TABLE: Record<
  string,
  Array<{ type: string; w: number }>
> = {
  grassland: [
    { type: 'rat', w: 2 },
    { type: 'giant-bat', w: 2 },
    { type: 'goblin', w: 3 },
    { type: 'wolf', w: 2 },
    { type: 'boar', w: 2 },
    { type: 'bandit', w: 2 },
    { type: 'giant-wasp', w: 1 },
  ],
  plains: [
    { type: 'rat', w: 2 },
    { type: 'goblin', w: 3 },
    { type: 'wolf', w: 2 },
    { type: 'dire-wolf', w: 1 },
    { type: 'bandit', w: 2 },
    { type: 'boar', w: 1 },
  ],
  forest: [
    { type: 'giant-centipede', w: 2 },
    { type: 'wolf', w: 3 },
    { type: 'goblin', w: 2 },
    { type: 'bear', w: 1 },
    { type: 'giant-spider', w: 2 },
    { type: 'kobold', w: 2 },
    { type: 'hobgoblin', w: 1 },
    { type: 'wererat', w: 1 },
    { type: 'troll', w: 1 },
  ],
  taiga: [
    { type: 'wolf', w: 3 },
    { type: 'ice-wolf', w: 2 },
    { type: 'frost-wight', w: 1 },
    { type: 'bear', w: 1 },
    { type: 'ogre', w: 1 },
  ],
  tundra: [
    { type: 'ice-wolf', w: 3 },
    { type: 'frost-wight', w: 2 },
    { type: 'skeleton', w: 2 },
    { type: 'zombie', w: 1 },
    { type: 'wraith', w: 1 },
  ],
  mountain: [
    { type: 'skeleton', w: 3 },
    { type: 'harpy', w: 2 },
    { type: 'bear', w: 1 },
    { type: 'earth-golem', w: 1 },
    { type: 'gnoll', w: 1 },
    { type: 'wyvern', w: 1 },
    { type: 'manticore', w: 1 },
  ],
  mountains: [
    { type: 'skeleton', w: 3 },
    { type: 'harpy', w: 2 },
    { type: 'bear', w: 1 },
    { type: 'earth-golem', w: 1 },
    { type: 'basilisk', w: 1 },
  ],
  desert: [
    { type: 'giant-scorpion', w: 3 },
    { type: 'sand-wraith', w: 2 },
    { type: 'dune-stalker', w: 2 },
    { type: 'skeleton', w: 1 },
    { type: 'basilisk', w: 1 },
  ],
  swamp: [
    { type: 'stirge', w: 2 },
    { type: 'lizardfolk', w: 3 },
    { type: 'crocodile', w: 2 },
    { type: 'swamp-hag', w: 1 },
    { type: 'ooze', w: 2 },
    { type: 'troll', w: 1 },
  ],
  marsh: [
    { type: 'stirge', w: 2 },
    { type: 'lizardfolk', w: 3 },
    { type: 'crocodile', w: 2 },
    { type: 'slime', w: 2 },
  ],
  jungle: [
    { type: 'giant-centipede', w: 2 },
    { type: 'jaguar', w: 3 },
    { type: 'giant-python', w: 2 },
    { type: 'giant-spider', w: 2 },
    { type: 'kobold', w: 1 },
    { type: 'chimera', w: 1 },
  ],
  coast: [
    { type: 'rat', w: 1 },
    { type: 'crocodile', w: 2 },
    { type: 'water-wisp', w: 2 },
    { type: 'bandit', w: 1 },
  ],
  beach: [
    { type: 'water-wisp', w: 2 },
    { type: 'crocodile', w: 1 },
    { type: 'bandit', w: 1 },
  ],
  hills: [
    { type: 'giant-bat', w: 2 },
    { type: 'goblin', w: 3 },
    { type: 'hobgoblin', w: 2 },
    { type: 'wolf', w: 2 },
    { type: 'bear', w: 1 },
    { type: 'ogre', w: 1 },
  ],
  tainted: [
    { type: 'wight', w: 2 },
    { type: 'ghoul', w: 2 },
    { type: 'skeleton', w: 2 },
    { type: 'ooze', w: 2 },
    { type: 'wraith', w: 1 },
    { type: 'spectral-knight', w: 1 },
  ],
  cave: [
    { type: 'rat', w: 3 },
    { type: 'giant-bat', w: 2 },
    { type: 'giant-centipede', w: 2 },
    { type: 'slime', w: 2 },
    { type: 'ooze', w: 1 },
    { type: 'shadow-hound', w: 1 },
  ],
  ruins: [
    { type: 'skeleton', w: 3 },
    { type: 'zombie', w: 2 },
    { type: 'ghoul', w: 2 },
    { type: 'spectral-knight', w: 1 },
    { type: 'mimic', w: 1 },
    { type: 'wraith', w: 1 },
  ],
};

export function pickTypeForBiome(biomeName: string): string {
  const key = biomeName?.toLowerCase();
  const table = BIOME_SPAWN_TABLE[key];
  if (!table || table.length === 0) {
    // default/fallback pool for unknown biomes - includes weak and common creatures
    const fallback = [
      { type: 'rat', w: 2 },
      { type: 'goblin', w: 2 },
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
