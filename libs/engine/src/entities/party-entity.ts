/**
 * Party entity - represents a group of players adventuring together
 */

import { GameEntity } from './game-entity.js';

export interface PartyMemberData {
  playerId: number;
  playerName: string;
  isLeader: boolean;
  joinedAt: Date;
}

export interface PartyData {
  id: number;
  name: string;
  leaderId: number;
  members: PartyMemberData[];
  createdAt: Date;
  maxSize: number;
}

export class PartyEntity extends GameEntity {
  public leaderId: number;
  public members: PartyMemberData[];
  public readonly createdAt: Date;
  public readonly maxSize: number;

  constructor(data: PartyData) {
    super(data.id, data.name);
    this.leaderId = data.leaderId;
    this.members = data.members;
    this.createdAt = data.createdAt;
    this.maxSize = data.maxSize;
  }

  /**
   * Get the leader of the party
   */
  getLeader(): PartyMemberData | undefined {
    return this.members.find((m) => m.isLeader);
  }

  /**
   * Check if player is in the party
   */
  hasMember(playerId: number): boolean {
    return this.members.some((m) => m.playerId === playerId);
  }

  /**
   * Check if player is the leader
   */
  isLeader(playerId: number): boolean {
    return this.leaderId === playerId;
  }

  /**
   * Check if party is full
   */
  isFull(): boolean {
    return this.members.length >= this.maxSize;
  }

  /**
   * Get party size
   */
  getSize(): number {
    return this.members.length;
  }

  /**
   * Add a member to the party
   */
  addMember(playerId: number, playerName: string): boolean {
    if (this.isFull()) {
      return false;
    }

    if (this.hasMember(playerId)) {
      return false;
    }

    this.members.push({
      playerId,
      playerName,
      isLeader: false,
      joinedAt: new Date(),
    });

    return true;
  }

  /**
   * Remove a member from the party
   */
  removeMember(playerId: number): boolean {
    const index = this.members.findIndex((m) => m.playerId === playerId);

    if (index === -1) {
      return false;
    }

    // Cannot remove leader this way
    if (this.members[index].isLeader) {
      return false;
    }

    this.members.splice(index, 1);
    return true;
  }

  /**
   * Transfer leadership to another member
   */
  transferLeadership(newLeaderId: number): boolean {
    if (!this.hasMember(newLeaderId)) {
      return false;
    }

    // Update old leader
    const oldLeader = this.members.find((m) => m.isLeader);
    if (oldLeader) {
      oldLeader.isLeader = false;
    }

    // Update new leader
    const newLeader = this.members.find((m) => m.playerId === newLeaderId);
    if (newLeader) {
      newLeader.isLeader = true;
      this.leaderId = newLeaderId;
      return true;
    }

    return false;
  }

  getEntityType(): string {
    return 'party';
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      leaderId: this.leaderId,
      members: this.members,
      createdAt: this.createdAt,
      maxSize: this.maxSize,
      currentSize: this.getSize(),
      type: this.getEntityType(),
    };
  }
}
