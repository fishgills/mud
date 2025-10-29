import type { TileInfo } from './tile-info.dto';
import type { Monster } from './monster.dto';
import type { PlayerItemDto } from './player-item.dto';

export interface PlayerEquipment {
  head: number | null;
  chest: number | null;
  legs: number | null;
  arms: number | null;
  weapon: number | null;
}

export interface Player {
  id: number;
  slackId?: string | null;
  clientId?: string | null;
  clientType?: string | null;
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
