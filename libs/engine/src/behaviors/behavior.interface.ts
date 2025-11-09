/**
 * Behavior interface for AI-controlled entities
 * Inspired by RanvierMUD's behavior system
 */

import { NpcEntity } from '../entities/npc-entity.js';

export interface BehaviorContext {
  entity: NpcEntity;
  nearbyPlayers?: Array<{ id: number; name: string; distance: number }>;
  nearbyMonsters?: Array<{ id: number; name: string; distance: number }>;
}

export interface Behavior {
  /**
   * Unique identifier for this behavior
   */
  readonly name: string;

  /**
   * Execute the behavior logic
   * @returns true if behavior executed successfully
   */
  execute(context: BehaviorContext): Promise<boolean>;

  /**
   * Check if this behavior should execute
   */
  shouldExecute(context: BehaviorContext): boolean;

  /**
   * Priority of this behavior (higher = more important)
   */
  priority: number;
}
