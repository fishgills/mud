export interface Player {
  id: number;
  clientId: string;
  clientType: string | null;
  slackId: string | null;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  level: number;
  skillPoints: number;
  gold: number;
  xp: number;
  isAlive: boolean;
  lastAction?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Monster {
  id: number;
  name: string;
  type: string;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  x: number;
  y: number;
  biomeId: number;
  isAlive: boolean;
  spawnedAt: Date;
  lastMove?: Date;
}

export const getPrismaClient = () => ({
  player: {},
  monster: {},
});
