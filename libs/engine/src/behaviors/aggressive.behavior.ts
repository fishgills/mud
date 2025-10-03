/**
 * Aggressive behavior - attack nearby players
 */

import { Behavior, BehaviorContext } from './behavior.interface';
import { MonsterEntity } from '../entities/monster-entity';

export class AggressiveBehavior implements Behavior {
  readonly name = 'aggressive';
  priority = 10; // Higher priority than movement

  private readonly aggroRange: number;

  constructor(aggroRange: number = 2) {
    this.aggroRange = aggroRange;
  }

  shouldExecute(context: BehaviorContext): boolean {
    if (!(context.entity instanceof MonsterEntity)) {
      return false;
    }

    if (!context.nearbyPlayers || context.nearbyPlayers.length === 0) {
      return false;
    }

    // Check if any players are within aggro range
    return context.nearbyPlayers.some(
      (player) => player.distance <= this.aggroRange,
    );
  }

  execute(context: BehaviorContext): Promise<boolean> {
    return Promise.resolve(this.executeSync(context));
  }

  private executeSync(context: BehaviorContext): boolean {
    if (!context.nearbyPlayers || context.nearbyPlayers.length === 0) {
      return false;
    }

    // Find closest player within aggro range
    const closestPlayer = context.nearbyPlayers
      .filter((p) => p.distance <= this.aggroRange)
      .sort((a, b) => a.distance - b.distance)[0];

    if (!closestPlayer) {
      return false;
    }

    // TODO: Trigger combat event
    // For now, just log the aggressive action
    console.log(
      `${context.entity.name} is aggressive towards player ${closestPlayer.name}`,
    );

    return true;
  }
}
