/**
 * NPC Factory - Creates and manages NPC entities
 * Will integrate with database once NPC table is added
 */

import { NpcEntity, NpcRole } from '../entities/npc-entity';

export interface CreateNpcOptions {
  name: string;
  role: NpcRole;
  x: number;
  y: number;
  settlementId?: number;
  dialogue?: string;
  isHostile?: boolean;
}

export class NpcFactory {
  private static npcIdCounter = 1;
  private static npcs: Map<number, NpcEntity> = new Map();

  /**
   * Create a new NPC (in-memory for now, will use database later)
   */
  static create(options: CreateNpcOptions): NpcEntity {
    const {
      name,
      role,
      x,
      y,
      settlementId,
      dialogue,
      isHostile = false,
    } = options;

    const id = this.npcIdCounter++;

    // Generate stats based on role
    const stats = this.generateStatsForRole(role);

    const npc = new NpcEntity({
      id,
      name,
      role,
      attributes: stats.attributes,
      combat: stats.combat,
      position: { x, y },
      settlementId,
      dialogue,
      isHostile,
    });

    this.npcs.set(id, npc);
    return npc;
  }

  /**
   * Load an NPC by ID
   */
  static load(id: number): NpcEntity | null {
    return this.npcs.get(id) || null;
  }

  /**
   * Load all NPCs at a location
   */
  static loadAtLocation(x: number, y: number): NpcEntity[] {
    return Array.from(this.npcs.values()).filter(
      (npc) => npc.position.x === x && npc.position.y === y,
    );
  }

  /**
   * Load all NPCs in a settlement
   */
  static loadInSettlement(settlementId: number): NpcEntity[] {
    return Array.from(this.npcs.values()).filter(
      (npc) => npc.settlementId === settlementId,
    );
  }

  /**
   * Delete an NPC
   */
  static delete(id: number): boolean {
    return this.npcs.delete(id);
  }

  /**
   * Clear all NPCs (useful for testing)
   */
  static clear(): void {
    this.npcs.clear();
    this.npcIdCounter = 1;
  }

  /**
   * Generate stats appropriate for an NPC role
   */
  private static generateStatsForRole(role: NpcRole): {
    attributes: { strength: number; agility: number; health: number };
    combat: { hp: number; maxHp: number; isAlive: boolean };
  } {
    let strength = 10;
    let agility = 10;
    let health = 10;

    switch (role) {
      case 'guard':
        strength = 14;
        agility = 12;
        health = 14;
        break;
      case 'merchant':
        strength = 8;
        agility = 10;
        health = 10;
        break;
      case 'quest_giver':
        strength = 10;
        agility = 10;
        health = 12;
        break;
      case 'innkeeper':
        strength = 10;
        agility = 8;
        health = 12;
        break;
      case 'citizen':
        strength = 8;
        agility = 10;
        health = 10;
        break;
    }

    const maxHp = 10 + health * 2;

    return {
      attributes: { strength, agility, health },
      combat: { hp: maxHp, maxHp, isAlive: true },
    };
  }
}
