/**
 * Party Factory - Creates and manages party entities
 * Will integrate with database once Party table is added
 */

import { PartyEntity, PartyMemberData } from '../entities/party-entity';
import { EventBus } from '../events';

export interface CreatePartyOptions {
  name: string;
  leaderId: number;
  leaderName: string;
  maxSize?: number;
}

export class PartyFactory {
  private static partyIdCounter = 1;
  private static parties: Map<number, PartyEntity> = new Map();

  /**
   * Create a new party
   */
  static async create(options: CreatePartyOptions): Promise<PartyEntity> {
    const { name, leaderId, leaderName, maxSize = 6 } = options;

    const id = this.partyIdCounter++;

    const members: PartyMemberData[] = [
      {
        playerId: leaderId,
        playerName: leaderName,
        isLeader: true,
        joinedAt: new Date(),
      },
    ];

    const party = new PartyEntity({
      id,
      name,
      leaderId,
      members,
      createdAt: new Date(),
      maxSize,
    });

    this.parties.set(id, party);

    // Emit party creation event
    await EventBus.emit({
      eventType: 'party:create',
      partyId: id,
      leaderId,
      leaderName,
      timestamp: new Date(),
    });

    return party;
  }

  /**
   * Load a party by ID
   */
  static load(id: number): PartyEntity | null {
    return this.parties.get(id) || null;
  }

  /**
   * Find party by player ID
   */
  static findByPlayerId(playerId: number): PartyEntity | null {
    const parties = Array.from(this.parties.values());
    for (const party of parties) {
      if (party.hasMember(playerId)) {
        return party;
      }
    }
    return null;
  }

  /**
   * Save a party (update in memory)
   */
  static save(party: PartyEntity): void {
    this.parties.set(party.id, party);
  }

  /**
   * Delete a party
   */
  static async delete(id: number): Promise<boolean> {
    const party = this.parties.get(id);
    if (!party) {
      return false;
    }

    // Emit disband event
    await EventBus.emit({
      eventType: 'party:disband',
      partyId: id,
      timestamp: new Date(),
    });

    return this.parties.delete(id);
  }

  /**
   * Get all parties
   */
  static getAll(): PartyEntity[] {
    return Array.from(this.parties.values());
  }

  /**
   * Clear all parties (useful for testing)
   */
  static clear(): void {
    this.parties.clear();
    this.partyIdCounter = 1;
  }
}
