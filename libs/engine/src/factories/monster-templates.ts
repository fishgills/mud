/**
 * Shared monster templates available to the engine.
 */

export interface MonsterTemplate {
  name: string;
  type: string;
  baseHp: number;
  strength: number;
  agility: number;
  health: number;
}

export const MONSTER_TEMPLATES: readonly MonsterTemplate[] = [
  // Weakest creatures (2-4 Vitality)
  {
    name: 'Snail',
    type: 'beast',
    baseHp: 6, // 10 + (-4 modifier from Vitality 2)
    strength: 3,
    agility: 2,
    health: 2,
  },
  {
    name: 'Crab',
    type: 'beast',
    baseHp: 7, // 10 + (-3 modifier from Vitality 4)
    strength: 5,
    agility: 8,
    health: 4,
  },
  {
    name: 'Field Rat',
    type: 'beast',
    baseHp: 8, // 10 + (-2 modifier from Vitality 6)
    strength: 5,
    agility: 12,
    health: 6,
  },
  // Weak creatures (6-8 Vitality)
  {
    name: 'Cave Bat',
    type: 'beast',
    baseHp: 8,
    strength: 6,
    agility: 14,
    health: 6,
  },
  {
    name: 'Bog Slime',
    type: 'ooze',
    baseHp: 9,
    strength: 7,
    agility: 8,
    health: 8,
  },
  {
    name: 'Goblin',
    type: 'humanoid',
    baseHp: 9,
    strength: 8,
    agility: 12,
    health: 8,
  },
  // Common enemies (10-12 Vitality)
  {
    name: 'Bandit',
    type: 'humanoid',
    baseHp: 10,
    strength: 10,
    agility: 10,
    health: 10,
  },
  {
    name: 'Wolf',
    type: 'beast',
    baseHp: 11,
    strength: 11,
    agility: 13,
    health: 12,
  },
  {
    name: 'Skeleton',
    type: 'undead',
    baseHp: 11,
    strength: 10,
    agility: 10,
    health: 12,
  },
  // Moderate enemies (14-16 Vitality)
  {
    name: 'Gnoll Hunter',
    type: 'humanoid',
    baseHp: 12,
    strength: 13,
    agility: 12,
    health: 14,
  },
  {
    name: 'Dire Wolf',
    type: 'beast',
    baseHp: 13,
    strength: 15,
    agility: 16,
    health: 16,
  },
  {
    name: 'Orc Brute',
    type: 'humanoid',
    baseHp: 13,
    strength: 16,
    agility: 8,
    health: 16,
  },
  // Strong enemies (18-22 Vitality)
  {
    name: 'Stone Golem',
    type: 'construct',
    baseHp: 14,
    strength: 18,
    agility: 6,
    health: 18,
  },
  {
    name: 'Troll Berserker',
    type: 'giant',
    baseHp: 15,
    strength: 20,
    agility: 8,
    health: 20,
  },
  {
    name: 'Necromancer',
    type: 'humanoid',
    baseHp: 16,
    strength: 12,
    agility: 14,
    health: 22,
  },
  {
    name: 'Wyvern',
    type: 'dragonkin',
    baseHp: 16,
    strength: 20,
    agility: 18,
    health: 22,
  },
  // Elite enemies (24-28 Vitality)
  {
    name: 'Fire Giant Warlord',
    type: 'giant',
    baseHp: 17,
    strength: 24,
    agility: 10,
    health: 24,
  },
  {
    name: 'Ancient Treant',
    type: 'elemental',
    baseHp: 18,
    strength: 22,
    agility: 8,
    health: 26,
  },
  {
    name: 'Young Dragon',
    type: 'dragon',
    baseHp: 19,
    strength: 26,
    agility: 20,
    health: 28,
  },
  // Boss enemies (30-36 Vitality)
  {
    name: 'Void Lich',
    type: 'undead',
    baseHp: 20,
    strength: 18,
    agility: 18,
    health: 30,
  },
  {
    name: 'Ancient Hydra',
    type: 'beast',
    baseHp: 21,
    strength: 24,
    agility: 14,
    health: 32,
  },
  {
    name: 'Storm Dragon',
    type: 'dragon',
    baseHp: 23,
    strength: 28,
    agility: 22,
    health: 36,
  },
  // Epic/Legendary (38-50 Vitality)
  {
    name: 'Celestial Phoenix',
    type: 'mythic',
    baseHp: 24,
    strength: 28,
    agility: 24,
    health: 38,
  },
  {
    name: 'Demon Lord',
    type: 'demon',
    baseHp: 27,
    strength: 32,
    agility: 26,
    health: 44,
  },
  {
    name: 'Elder Dragon',
    type: 'dragon',
    baseHp: 30,
    strength: 36,
    agility: 28,
    health: 50,
  },
  {
    name: 'World Eater Titan',
    type: 'mythic',
    baseHp: 360, // 10 + (70 * 5) - special epic boss with 700 HP
    strength: 40,
    agility: 20,
    health: 70,
  },
];
