import type { PlayerItemDto } from './player-item.dto';
import type { PlayerEquipment } from '@mud/database';

export interface Player {
  id: number;
  name: string;
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
  equipment?: PlayerEquipment;
  bag?: PlayerItemDto[];
}
