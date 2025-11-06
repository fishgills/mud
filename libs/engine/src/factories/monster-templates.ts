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
  {
    name: 'Goblin',
    type: 'humanoid',
    baseHp: 20,
    strength: 8,
    agility: 12,
    health: 8,
  },
  {
    name: 'Field Rat',
    type: 'beast',
    baseHp: 10,
    strength: 5,
    agility: 12,
    health: 6,
  },
  {
    name: 'Cave Bat',
    type: 'beast',
    baseHp: 12,
    strength: 6,
    agility: 14,
    health: 6,
  },
  {
    name: 'Bog Slime',
    type: 'ooze',
    baseHp: 18,
    strength: 7,
    agility: 8,
    health: 9,
  },
  {
    name: 'Bandit Cutthroat',
    type: 'humanoid',
    baseHp: 28,
    strength: 11,
    agility: 11,
    health: 10,
  },
  {
    name: 'Skeleton Warrior',
    type: 'undead',
    baseHp: 35,
    strength: 10,
    agility: 10,
    health: 12,
  },
  {
    name: 'Gnoll Hunter',
    type: 'humanoid',
    baseHp: 42,
    strength: 13,
    agility: 12,
    health: 12,
  },
  {
    name: 'Dire Wolf',
    type: 'beast',
    baseHp: 60,
    strength: 15,
    agility: 16,
    health: 12,
  },
  {
    name: 'Orc Brute',
    type: 'humanoid',
    baseHp: 55,
    strength: 16,
    agility: 8,
    health: 16,
  },
  {
    name: 'Stone Golem',
    type: 'construct',
    baseHp: 90,
    strength: 18,
    agility: 6,
    health: 18,
  },
  {
    name: 'Troll Berserker',
    type: 'giant',
    baseHp: 110,
    strength: 20,
    agility: 8,
    health: 20,
  },
  {
    name: 'Necromancer',
    type: 'humanoid',
    baseHp: 130,
    strength: 12,
    agility: 14,
    health: 22,
  },
  {
    name: 'Wyvern Matriarch',
    type: 'dragonkin',
    baseHp: 150,
    strength: 20,
    agility: 18,
    health: 16,
  },
  {
    name: 'Fire Giant Warlord',
    type: 'giant',
    baseHp: 220,
    strength: 24,
    agility: 10,
    health: 22,
  },
  {
    name: 'Ancient Treant',
    type: 'elemental',
    baseHp: 260,
    strength: 22,
    agility: 8,
    health: 24,
  },
  {
    name: 'Storm Dragon',
    type: 'dragon',
    baseHp: 320,
    strength: 26,
    agility: 20,
    health: 28,
  },
  {
    name: 'Void Lich',
    type: 'undead',
    baseHp: 380,
    strength: 18,
    agility: 18,
    health: 30,
  },
  {
    name: 'Elder Hydra',
    type: 'beast',
    baseHp: 420,
    strength: 24,
    agility: 14,
    health: 32,
  },
  {
    name: 'Celestial Phoenix',
    type: 'mythic',
    baseHp: 460,
    strength: 28,
    agility: 24,
    health: 30,
  },
  {
    name: 'World Eater Titan',
    type: 'mythic',
    baseHp: 500,
    strength: 32,
    agility: 18,
    health: 34,
  },
];
