/**
 * Behavior Manager - Execute behaviors for entities
 */

import { Behavior, BehaviorContext } from './behavior.interface';

export class BehaviorManager {
  private behaviors: Map<string, Behavior[]> = new Map();

  /**
   * Register a behavior for an entity
   */
  registerBehavior(entityId: string, behavior: Behavior): void {
    if (!this.behaviors.has(entityId)) {
      this.behaviors.set(entityId, []);
    }

    this.behaviors.get(entityId)!.push(behavior);

    // Sort by priority (highest first)
    this.behaviors.get(entityId)!.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a behavior from an entity
   */
  removeBehavior(entityId: string, behaviorName: string): boolean {
    const behaviors = this.behaviors.get(entityId);
    if (!behaviors) {
      return false;
    }

    const index = behaviors.findIndex((b) => b.name === behaviorName);
    if (index === -1) {
      return false;
    }

    behaviors.splice(index, 1);
    return true;
  }

  /**
   * Execute behaviors for an entity
   */
  async executeBehaviors(
    entityId: string,
    context: BehaviorContext,
  ): Promise<void> {
    const behaviors = this.behaviors.get(entityId);
    if (!behaviors) {
      return;
    }

    for (const behavior of behaviors) {
      if (behavior.shouldExecute(context)) {
        const executed = await behavior.execute(context);
        if (executed) {
          // Stop after first successful behavior execution
          break;
        }
      }
    }
  }

  /**
   * Get all behaviors for an entity
   */
  getBehaviors(entityId: string): Behavior[] {
    return this.behaviors.get(entityId) || [];
  }

  /**
   * Clear all behaviors for an entity
   */
  clearBehaviors(entityId: string): void {
    this.behaviors.delete(entityId);
  }

  /**
   * Clear all behaviors
   */
  clearAll(): void {
    this.behaviors.clear();
  }
}

// Global behavior manager instance
export const globalBehaviorManager = new BehaviorManager();
