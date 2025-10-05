/**
 * Random movement behavior for monsters
 */

import { Behavior, BehaviorContext } from './behavior.interface.js';
import { MonsterEntity } from '../entities/monster-entity.js';

export class RandomMovementBehavior implements Behavior {
  readonly name = 'random_movement';
  priority = 1;

  private readonly moveChance: number;
  private readonly minSecondsBetweenMoves: number;

  constructor(moveChance: number = 0.5, minSecondsBetweenMoves: number = 30) {
    this.moveChance = moveChance;
    this.minSecondsBetweenMoves = minSecondsBetweenMoves;
  }

  shouldExecute(context: BehaviorContext): boolean {
    if (!(context.entity instanceof MonsterEntity)) {
      return false;
    }

    return context.entity.shouldMove(this.minSecondsBetweenMoves);
  }

  execute(context: BehaviorContext): Promise<boolean> {
    return Promise.resolve(this.executeSync(context));
  }

  private executeSync(context: BehaviorContext): boolean {
    if (!(context.entity instanceof MonsterEntity)) {
      return false;
    }

    // Random chance to move
    if (Math.random() > this.moveChance) {
      return false;
    }

    const directions = [
      { dx: 0, dy: -1 }, // North
      { dx: 0, dy: 1 }, // South
      { dx: 1, dy: 0 }, // East
      { dx: -1, dy: 0 }, // West
    ];

    const direction = directions[Math.floor(Math.random() * directions.length)];
    const newX = context.entity.position.x + direction.dx;
    const newY = context.entity.position.y + direction.dy;

    context.entity.moveTo(newX, newY);
    context.entity.updateLastMove();

    return true;
  }
}
