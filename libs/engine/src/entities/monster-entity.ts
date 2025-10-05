/**
 * Monster entity - represents hostile creatures
 */

import { Character, Attributes, CombatStats, Position } from './character.js';

export interface MonsterData {
  id: number;
  name: string;
  type: string; // species/template name
  attributes: Attributes;
  combat: CombatStats;
  position: Position;
  biomeId: number;
  spawnedAt: Date;
}

export class MonsterEntity extends Character {
  public readonly type: string;
  public readonly biomeId: number;
  public readonly spawnedAt: Date;
  public lastMove: Date;

  constructor(data: MonsterData) {
    super(data.id, data.name, data.attributes, data.combat, data.position);
    this.type = data.type;
    this.biomeId = data.biomeId;
    this.spawnedAt = data.spawnedAt;
    this.lastMove = new Date();
  }

  /**
   * Calculate XP reward for killing this monster
   */
  getXpReward(): number {
    const baseXp = 10;
    const strengthBonus = this.attributes.strength * 2;
    const healthBonus = this.attributes.health * 2;
    const agilityBonus = this.attributes.agility;

    return Math.floor(baseXp + strengthBonus + healthBonus + agilityBonus);
  }

  /**
   * Calculate gold reward for killing this monster
   */
  getGoldReward(): number {
    const baseGold = 5;
    const levelBonus = Math.floor(this.getXpReward() / 10);
    const variance = Math.floor(Math.random() * 5);

    return baseGold + levelBonus + variance;
  }

  /**
   * Check if monster should move (based on time since last move)
   */
  shouldMove(minSecondsBetweenMoves: number = 30): boolean {
    const now = new Date();
    const timeSinceLastMove = (now.getTime() - this.lastMove.getTime()) / 1000;
    return timeSinceLastMove >= minSecondsBetweenMoves;
  }

  /**
   * Update last move timestamp
   */
  updateLastMove(): void {
    this.lastMove = new Date();
  }

  getEntityType(): string {
    return 'monster';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      type: this.type,
      biomeId: this.biomeId,
      spawnedAt: this.spawnedAt,
      lastMove: this.lastMove,
    };
  }
}
