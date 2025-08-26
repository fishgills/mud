import { Monster } from '@mud/database';

export interface SpawnConstraints {
  radius?: number;
  avoidSettlementsWithin?: number; // tiles to avoid around settlements
  maxGroupSize?: number; // cap per spawn call
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface IMonsterEngine {
  getAllMonsters(): Promise<Monster[]>;
  getMonstersAtLocation(x: number, y: number): Promise<Monster[]>;
  spawnMonstersInArea(
    centerX: number,
    centerY: number,
    radius?: number,
    constraints?: SpawnConstraints,
  ): Promise<Monster[]>;
  moveMonster(monsterId: number): Promise<Monster>;
  damageMonster(monsterId: number, damage: number): Promise<Monster>;
  cleanupDeadMonsters(): Promise<void>;
}

export const MONSTER_ENGINE = Symbol('MONSTER_ENGINE');
