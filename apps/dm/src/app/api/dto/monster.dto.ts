export interface Monster {
  id: number;
  name: string;
  type: string;
  damageRoll: string;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  x: number;
  y: number;
  isAlive: boolean;
  lastMove: Date;
  spawnedAt: Date;
  biomeId: number;
  worldTileId?: number;
  createdAt: Date;
  updatedAt: Date;
}
