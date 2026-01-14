export interface Monster {
  id: number;
  name: string;
  type: string;
  variant: string;
  tier: number;
  damageRoll: string;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  isAlive: boolean;
  spawnedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
