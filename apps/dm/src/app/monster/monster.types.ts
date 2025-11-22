export interface MonsterTemplate {
  name: string;
  type: string; // unique key
  baseHp: number;
  strength: number;
  agility: number;
  health: number;
  damageRoll: string;
}

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  // Humanoids
  {
    name: 'Goblin',
    type: 'goblin',
    baseHp: 25,
    strength: 6,
    agility: 12,
    health: 6,
    damageRoll: '1d6',
  },
  {
    name: 'Hobgoblin',
    type: 'hobgoblin',
    baseHp: 32,
    strength: 10,
    agility: 10,
    health: 8,
    damageRoll: '1d8',
  },
  {
    name: 'Kobold',
    type: 'kobold',
    baseHp: 18,
    strength: 5,
    agility: 13,
    health: 5,
    damageRoll: '1d4',
  },
  {
    name: 'Bandit',
    type: 'bandit',
    baseHp: 28,
    strength: 9,
    agility: 11,
    health: 8,
    damageRoll: '1d6',
  },
  {
    name: 'Cultist',
    type: 'cultist',
    baseHp: 26,
    strength: 7,
    agility: 9,
    health: 9,
    damageRoll: '1d4',
  },
  {
    name: 'Orc',
    type: 'orc',
    baseHp: 40,
    strength: 12,
    agility: 8,
    health: 10,
    damageRoll: '1d12',
  },
  {
    name: 'Gnoll',
    type: 'gnoll',
    baseHp: 35,
    strength: 11,
    agility: 9,
    health: 9,
    damageRoll: '1d8',
  },

  // Beasts
  {
    name: 'Wolf',
    type: 'wolf',
    baseHp: 30,
    strength: 10,
    agility: 14,
    health: 8,
    damageRoll: '2d4',
  },
  {
    name: 'Dire Wolf',
    type: 'dire-wolf',
    baseHp: 44,
    strength: 13,
    agility: 13,
    health: 10,
    damageRoll: '2d6',
  },
  {
    name: 'Wild Boar',
    type: 'boar',
    baseHp: 34,
    strength: 12,
    agility: 7,
    health: 10,
    damageRoll: '1d8',
  },
  {
    name: 'Black Bear',
    type: 'bear',
    baseHp: 60,
    strength: 16,
    agility: 6,
    health: 14,
    damageRoll: '2d6',
  },
  {
    name: 'Giant Spider',
    type: 'giant-spider',
    baseHp: 36,
    strength: 10,
    agility: 12,
    health: 9,
    damageRoll: '1d8',
  },
  {
    name: 'Giant Scorpion',
    type: 'giant-scorpion',
    baseHp: 42,
    strength: 12,
    agility: 10,
    health: 11,
    damageRoll: '1d10',
  },
  {
    name: 'Crocodile',
    type: 'crocodile',
    baseHp: 50,
    strength: 15,
    agility: 6,
    health: 12,
    damageRoll: '1d10',
  },
  {
    name: 'Harpy',
    type: 'harpy',
    baseHp: 33,
    strength: 9,
    agility: 14,
    health: 8,
    damageRoll: '2d4',
  },
  {
    name: 'Giant Wasp',
    type: 'giant-wasp',
    baseHp: 24,
    strength: 7,
    agility: 15,
    health: 6,
    damageRoll: '1d6',
  },

  // Undead
  {
    name: 'Skeleton',
    type: 'skeleton',
    baseHp: 20,
    strength: 8,
    agility: 10,
    health: 6,
    damageRoll: '1d6',
  },
  {
    name: 'Zombie',
    type: 'zombie',
    baseHp: 34,
    strength: 10,
    agility: 4,
    health: 12,
    damageRoll: '1d6',
  },
  {
    name: 'Ghoul',
    type: 'ghoul',
    baseHp: 32,
    strength: 9,
    agility: 12,
    health: 9,
    damageRoll: '2d4',
  },
  {
    name: 'Wight',
    type: 'wight',
    baseHp: 46,
    strength: 12,
    agility: 10,
    health: 12,
    damageRoll: '1d8',
  },

  // Elemental/Arcane
  {
    name: 'Fire Sprite',
    type: 'fire-sprite',
    baseHp: 22,
    strength: 7,
    agility: 14,
    health: 6,
    damageRoll: '1d4',
  },
  {
    name: 'Water Wisp',
    type: 'water-wisp',
    baseHp: 22,
    strength: 6,
    agility: 13,
    health: 7,
    damageRoll: '1d4',
  },
  {
    name: 'Air Mote',
    type: 'air-mote',
    baseHp: 20,
    strength: 5,
    agility: 16,
    health: 6,
    damageRoll: '1d4',
  },
  {
    name: 'Earth Golem',
    type: 'earth-golem',
    baseHp: 70,
    strength: 18,
    agility: 4,
    health: 16,
    damageRoll: '2d8',
  },
  {
    name: 'Slime',
    type: 'slime',
    baseHp: 28,
    strength: 7,
    agility: 6,
    health: 12,
    damageRoll: '1d6',
  },
  {
    name: 'Ooze',
    type: 'ooze',
    baseHp: 36,
    strength: 9,
    agility: 5,
    health: 13,
    damageRoll: '2d6',
  },
  {
    name: 'Mimic',
    type: 'mimic',
    baseHp: 44,
    strength: 13,
    agility: 6,
    health: 12,
    damageRoll: '1d8',
  },

  // Cold/Arctic
  {
    name: 'Ice Wolf',
    type: 'ice-wolf',
    baseHp: 34,
    strength: 11,
    agility: 13,
    health: 10,
    damageRoll: '2d4',
  },
  {
    name: 'Frost Wight',
    type: 'frost-wight',
    baseHp: 48,
    strength: 13,
    agility: 10,
    health: 12,
    damageRoll: '1d8',
  },

  // Swamp/Marsh
  {
    name: 'Lizardfolk',
    type: 'lizardfolk',
    baseHp: 38,
    strength: 12,
    agility: 9,
    health: 11,
    damageRoll: '1d6',
  },
  {
    name: 'Swamp Hag',
    type: 'swamp-hag',
    baseHp: 52,
    strength: 14,
    agility: 8,
    health: 12,
    damageRoll: '2d6',
  },

  // Jungle
  {
    name: 'Jaguar',
    type: 'jaguar',
    baseHp: 36,
    strength: 12,
    agility: 15,
    health: 9,
    damageRoll: '1d8',
  },
  {
    name: 'Giant Python',
    type: 'giant-python',
    baseHp: 50,
    strength: 16,
    agility: 7,
    health: 12,
    damageRoll: '2d6',
  },

  // Desert
  {
    name: 'Sand Wraith',
    type: 'sand-wraith',
    baseHp: 38,
    strength: 11,
    agility: 13,
    health: 10,
    damageRoll: '1d8',
  },
  {
    name: 'Dune Stalker',
    type: 'dune-stalker',
    baseHp: 34,
    strength: 10,
    agility: 14,
    health: 9,
    damageRoll: '1d6',
  },
];

// Quick lookup by type
export const MONSTER_TEMPLATE_BY_TYPE: Record<string, MonsterTemplate> =
  Object.fromEntries(MONSTER_TEMPLATES.map((t) => [t.type, t]));

export function getMonsterTemplate(type: string): MonsterTemplate {
  return MONSTER_TEMPLATE_BY_TYPE[type] ?? MONSTER_TEMPLATE_BY_TYPE['goblin'];
}

// Biome spawn tables
export const BIOME_SPAWN_TABLE: Record<
  string,
  Array<{ type: string; w: number }>
> = {
  grassland: [
    { type: 'goblin', w: 3 },
    { type: 'wolf', w: 2 },
    { type: 'boar', w: 2 },
    { type: 'bandit', w: 2 },
    { type: 'giant-wasp', w: 1 },
  ],
  plains: [
    { type: 'goblin', w: 3 },
    { type: 'wolf', w: 2 },
    { type: 'dire-wolf', w: 1 },
    { type: 'bandit', w: 2 },
  ],
  forest: [
    { type: 'wolf', w: 3 },
    { type: 'goblin', w: 2 },
    { type: 'bear', w: 1 },
    { type: 'giant-spider', w: 2 },
    { type: 'kobold', w: 2 },
    { type: 'hobgoblin', w: 1 },
  ],
  taiga: [
    { type: 'wolf', w: 3 },
    { type: 'ice-wolf', w: 2 },
    { type: 'frost-wight', w: 1 },
    { type: 'bear', w: 1 },
  ],
  tundra: [
    { type: 'ice-wolf', w: 3 },
    { type: 'frost-wight', w: 2 },
    { type: 'skeleton', w: 2 },
    { type: 'zombie', w: 1 },
  ],
  mountain: [
    { type: 'skeleton', w: 3 },
    { type: 'harpy', w: 2 },
    { type: 'bear', w: 1 },
    { type: 'earth-golem', w: 1 },
    { type: 'gnoll', w: 1 },
  ],
  mountains: [
    { type: 'skeleton', w: 3 },
    { type: 'harpy', w: 2 },
    { type: 'bear', w: 1 },
    { type: 'earth-golem', w: 1 },
  ],
  desert: [
    { type: 'giant-scorpion', w: 3 },
    { type: 'sand-wraith', w: 2 },
    { type: 'dune-stalker', w: 2 },
    { type: 'skeleton', w: 1 },
  ],
  swamp: [
    { type: 'lizardfolk', w: 3 },
    { type: 'crocodile', w: 2 },
    { type: 'swamp-hag', w: 1 },
    { type: 'ooze', w: 2 },
  ],
  marsh: [
    { type: 'lizardfolk', w: 3 },
    { type: 'crocodile', w: 2 },
    { type: 'slime', w: 2 },
  ],
  jungle: [
    { type: 'jaguar', w: 3 },
    { type: 'giant-python', w: 2 },
    { type: 'giant-spider', w: 2 },
    { type: 'kobold', w: 1 },
  ],
  coast: [
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
    { type: 'goblin', w: 3 },
    { type: 'hobgoblin', w: 2 },
    { type: 'wolf', w: 2 },
    { type: 'bear', w: 1 },
  ],
  tainted: [
    { type: 'wight', w: 2 },
    { type: 'ghoul', w: 2 },
    { type: 'skeleton', w: 2 },
    { type: 'ooze', w: 2 },
  ],
};

export function pickTypeForBiome(biomeName: string): string {
  const key = biomeName?.toLowerCase();
  const table = BIOME_SPAWN_TABLE[key];
  if (!table || table.length === 0) {
    // default/fallback pool for unknown biomes
    const fallback = [
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
