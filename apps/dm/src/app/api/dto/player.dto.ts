import type { TileInfo } from './tile-info.dto';
import type { Monster } from './monster.dto';
import type { PlayerItemDto } from './player-item.dto';
import type { PlayerEquipment } from '@mud/database';

export interface Player {
  id: number;
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
  isCreationComplete: boolean;
  lastAction?: Date;
  createdAt?: Date;
  updatedAt: Date;
  worldTileId?: number | null;
  currentTile?: TileInfo;
  nearbyPlayers?: Player[];
  nearbyMonsters?: Monster[];
  equipment?: PlayerEquipment;
  bag?: PlayerItemDto[];
}
