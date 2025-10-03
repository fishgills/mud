/**
 * Base class for all characters (Players, NPCs, Monsters)
 * Provides common functionality for combat, movement, and attributes
 */

import { GameEntity } from './game-entity';

export interface Attributes {
  strength: number;
  agility: number;
  health: number;
}

export interface CombatStats {
  hp: number;
  maxHp: number;
  isAlive: boolean;
}

export interface Position {
  x: number;
  y: number;
}

export abstract class Character extends GameEntity {
  public attributes: Attributes;
  public combat: CombatStats;
  public position: Position;

  constructor(
    id: number,
    name: string,
    attributes: Attributes,
    combat: CombatStats,
    position: Position,
  ) {
    super(id, name);
    this.attributes = attributes;
    this.combat = combat;
    this.position = position;
  }

  /**
   * Calculate attack power based on strength and agility
   */
  getAttackPower(): number {
    return Math.floor(
      this.attributes.strength * 1.5 + this.attributes.agility * 0.5,
    );
  }

  /**
   * Calculate defense based on agility
   */
  getDefense(): number {
    return Math.floor(this.attributes.agility * 1.2);
  }

  /**
   * Take damage and update HP
   */
  takeDamage(amount: number): number {
    const actualDamage = Math.max(0, amount);
    this.combat.hp = Math.max(0, this.combat.hp - actualDamage);

    if (this.combat.hp === 0) {
      this.combat.isAlive = false;
    }

    return actualDamage;
  }

  /**
   * Heal HP (cannot exceed maxHp)
   */
  heal(amount: number): number {
    const oldHp = this.combat.hp;
    this.combat.hp = Math.min(this.combat.maxHp, this.combat.hp + amount);
    return this.combat.hp - oldHp;
  }

  /**
   * Check if character is alive
   */
  isAlive(): boolean {
    return this.combat.isAlive && this.combat.hp > 0;
  }

  /**
   * Move to new position
   */
  moveTo(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  /**
   * Get distance to another position
   */
  distanceTo(x: number, y: number): number {
    const dx = this.position.x - x;
    const dy = this.position.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      attributes: this.attributes,
      combat: this.combat,
      position: this.position,
      type: this.getEntityType(),
    };
  }
}
