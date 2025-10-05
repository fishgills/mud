/**
 * Patrol behavior for NPCs (guards, etc.)
 */

import { Behavior, BehaviorContext } from './behavior.interface';
import { NpcEntity } from '../entities/npc-entity';

export interface PatrolPoint {
  x: number;
  y: number;
}

export class PatrolBehavior implements Behavior {
  readonly name = 'patrol';
  priority = 5;

  private readonly patrolPath: PatrolPoint[];
  private currentPatrolIndex: number = 0;
  private readonly waitTime: number;
  private lastMoveTime: Date;

  constructor(patrolPath: PatrolPoint[], waitTime: number = 10000) {
    this.patrolPath = patrolPath;
    this.waitTime = waitTime;
    this.lastMoveTime = new Date();
  }

  shouldExecute(context: BehaviorContext): boolean {
    if (!(context.entity instanceof NpcEntity)) {
      return false;
    }

    if (this.patrolPath.length === 0) {
      return false;
    }

    // Check if enough time has passed since last move
    const now = new Date();
    const timeSinceLastMove = now.getTime() - this.lastMoveTime.getTime();
    return timeSinceLastMove >= this.waitTime;
  }

  execute(context: BehaviorContext): Promise<boolean> {
    return Promise.resolve(this.executeSync(context));
  }

  private executeSync(context: BehaviorContext): boolean {
    if (!(context.entity instanceof NpcEntity)) {
      return false;
    }

    // Get next patrol point
    const targetPoint = this.patrolPath[this.currentPatrolIndex];

    // Check if already at target
    if (
      context.entity.position.x === targetPoint.x &&
      context.entity.position.y === targetPoint.y
    ) {
      // Move to next patrol point
      this.currentPatrolIndex =
        (this.currentPatrolIndex + 1) % this.patrolPath.length;
      this.lastMoveTime = new Date();
      return false;
    }

    // Move one step towards target
    const dx = Math.sign(targetPoint.x - context.entity.position.x);
    const dy = Math.sign(targetPoint.y - context.entity.position.y);

    context.entity.moveTo(
      context.entity.position.x + dx,
      context.entity.position.y + dy,
    );

    this.lastMoveTime = new Date();
    return true;
  }
}
