/**
 * Player entity - represents a human-controlled character
 */

import { Character, Attributes, CombatStats, Position } from './character';

export type ClientType = 'slack' | 'discord' | 'web';

export interface PlayerData {
  id: number;
  clientId: string; // Slack ID, Discord ID, session token, etc.
  clientType: ClientType;
  name: string;
  attributes: Attributes;
  combat: CombatStats;
  position: Position;
  gold: number;
  xp: number;
  level: number;
  skillPoints: number;
  partyId?: number;
}

export class PlayerEntity extends Character {
  public readonly clientId: string;
  public readonly clientType: ClientType;
  public gold: number;
  public xp: number;
  public level: number;
  public skillPoints: number;
  public partyId?: number;

  constructor(data: PlayerData) {
    super(data.id, data.name, data.attributes, data.combat, data.position);
    this.clientId = data.clientId;
    this.clientType = data.clientType;
    this.gold = data.gold;
    this.xp = data.xp;
    this.level = data.level;
    this.skillPoints = data.skillPoints;
    this.partyId = data.partyId;
  }

  /**
   * Award XP and check for level up
   */
  awardXp(amount: number): boolean {
    this.xp += amount;
    const xpNeeded = this.getXpForNextLevel();

    if (this.xp >= xpNeeded) {
      return true; // Level up available
    }

    return false;
  }

  /**
   * Get XP required for next level
   */
  getXpForNextLevel(): number {
    return this.level * 100;
  }

  /**
   * Level up the player
   */
  levelUp(): void {
    this.level += 1;

    // Award skill points
    if (this.level % 4 === 0) {
      this.skillPoints += 2;
    }

    // Increase max HP based on health attribute
    const hpGain = this.calculateLevelUpHpGain();
    this.combat.maxHp += hpGain;
    this.combat.hp = this.combat.maxHp; // Full heal on level up
  }

  /**
   * Calculate HP gain on level up
   */
  private calculateLevelUpHpGain(): number {
    const hitDieAverage = 6;
    const constitutionModifier = Math.floor((this.attributes.health - 10) / 2);
    return Math.max(1, hitDieAverage + constitutionModifier);
  }

  /**
   * Spend a skill point on an attribute
   */
  spendSkillPoint(attribute: keyof Attributes): boolean {
    if (this.skillPoints <= 0) {
      return false;
    }

    if (this.attributes[attribute] >= 20) {
      return false; // Max attribute value
    }

    this.attributes[attribute] += 1;
    this.skillPoints -= 1;

    // Recalculate maxHp if health was increased
    if (attribute === 'health') {
      this.combat.maxHp += 2;
      this.combat.hp = Math.min(this.combat.hp + 2, this.combat.maxHp);
    }

    return true;
  }

  /**
   * Award gold
   */
  awardGold(amount: number): void {
    this.gold += amount;
  }

  /**
   * Check if player is in a party
   */
  isInParty(): boolean {
    return this.partyId !== undefined && this.partyId !== null;
  }

  getEntityType(): string {
    return 'player';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      clientId: this.clientId,
      clientType: this.clientType,
      gold: this.gold,
      xp: this.xp,
      level: this.level,
      skillPoints: this.skillPoints,
      partyId: this.partyId,
    };
  }
}
