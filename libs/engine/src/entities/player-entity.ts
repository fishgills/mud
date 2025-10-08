/**
 * Player entity - represents a human-controlled character
 */

import { Character, Attributes, CombatStats, Position } from './character.js';

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

const HIT_DIE_AVERAGE = 6; // Average roll for a d10 hit die (fighter-style class)

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
    const constitutionModifier = this.getConstitutionModifier(
      this.attributes.health,
    );
    return Math.max(1, HIT_DIE_AVERAGE + constitutionModifier);
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

    const previousValue = this.attributes[attribute];
    const newValue = previousValue + 1;

    this.attributes[attribute] = newValue;
    this.skillPoints -= 1;

    // Recalculate maxHp if health (vitality) was increased
    if (attribute === 'health') {
      this.applyConstitutionAdjustment(previousValue, newValue);
    }

    return true;
  }

  private getConstitutionModifier(health: number): number {
    return Math.floor((health - 10) / 2);
  }

  private applyConstitutionAdjustment(
    previousHealth: number,
    newHealth: number,
  ): void {
    const previousModifier = this.getConstitutionModifier(previousHealth);
    const newModifier = this.getConstitutionModifier(newHealth);
    const modifierDelta = newModifier - previousModifier;

    if (modifierDelta === 0) {
      return;
    }

    const hpDelta = modifierDelta * this.level;
    this.combat.maxHp = Math.max(1, this.combat.maxHp + hpDelta);

    if (hpDelta > 0) {
      this.combat.hp = Math.min(this.combat.hp + hpDelta, this.combat.maxHp);
    } else {
      this.combat.hp = Math.min(this.combat.hp, this.combat.maxHp);
    }
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
