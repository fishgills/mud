/**
 * NPC entity - represents non-player characters (merchants, quest givers, guards, etc.)
 */

import { Character, Attributes, CombatStats, Position } from './character';

export type NpcRole =
  | 'merchant'
  | 'quest_giver'
  | 'guard'
  | 'citizen'
  | 'innkeeper';

export interface NpcData {
  id: number;
  name: string;
  role: NpcRole;
  attributes: Attributes;
  combat: CombatStats;
  position: Position;
  settlementId?: number;
  dialogue?: string;
  isHostile: boolean;
}

export class NpcEntity extends Character {
  public readonly role: NpcRole;
  public readonly settlementId?: number;
  public dialogue?: string;
  public isHostile: boolean;

  constructor(data: NpcData) {
    super(data.id, data.name, data.attributes, data.combat, data.position);
    this.role = data.role;
    this.settlementId = data.settlementId;
    this.dialogue = data.dialogue;
    this.isHostile = data.isHostile;
  }

  /**
   * Check if NPC can offer quests
   */
  canOfferQuests(): boolean {
    return this.role === 'quest_giver';
  }

  /**
   * Check if NPC is a merchant
   */
  isMerchant(): boolean {
    return this.role === 'merchant';
  }

  /**
   * Check if NPC is in a settlement
   */
  isInSettlement(): boolean {
    return this.settlementId !== undefined && this.settlementId !== null;
  }

  /**
   * Set dialogue for this NPC
   */
  setDialogue(dialogue: string): void {
    this.dialogue = dialogue;
  }

  /**
   * Get greeting based on role
   */
  getGreeting(): string {
    switch (this.role) {
      case 'merchant':
        return `Welcome, traveler! ${this.name} has goods to sell.`;
      case 'quest_giver':
        return `Greetings, ${this.name} has a task for you.`;
      case 'guard':
        return `Stay vigilant, adventurer.`;
      case 'innkeeper':
        return `Welcome to the inn! Rest and recover your strength.`;
      case 'citizen':
        return `Hello there!`;
      default:
        return `${this.name} nods at you.`;
    }
  }

  getEntityType(): string {
    return 'npc';
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      role: this.role,
      settlementId: this.settlementId,
      dialogue: this.dialogue,
      isHostile: this.isHostile,
    };
  }
}
