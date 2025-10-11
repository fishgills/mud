import type { WorldTile } from './world-tile.model';

export interface Player {
  id: number;
  slackId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  gold: number;
  xp: number;
  level: number;
  skillPoints: number;
  isAlive: boolean;
  lastAction: Date;
  createdAt: Date;
  updatedAt: Date;
  worldTileId?: number | null;
  worldTile?: WorldTile;
}
