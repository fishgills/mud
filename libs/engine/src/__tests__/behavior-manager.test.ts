import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { BehaviorManager } from '../behaviors/behavior-manager';
import { BehaviorContext } from '../behaviors/behavior.interface';
import { MonsterEntity } from '../entities/monster-entity';

const createMonster = () =>
  new MonsterEntity({
    id: 1,
    name: 'Goblin',
    type: 'humanoid',
    attributes: { strength: 8, agility: 10, health: 9 },
    combat: { hp: 20, maxHp: 20, isAlive: true },
    position: { x: 0, y: 0 },
    biomeId: 1,
    spawnedAt: new Date('2024-01-01T00:00:00Z'),
  });

describe('BehaviorManager', () => {
  const manager = new BehaviorManager();

  afterEach(() => {
    manager.clearAll();
    jest.restoreAllMocks();
  });

  it('registers behaviors in priority order', () => {
    const behaviorA = {
      name: 'A',
      priority: 1,
      shouldExecute: jest.fn().mockReturnValue(false),
      execute: jest.fn(),
    };
    const behaviorB = {
      name: 'B',
      priority: 5,
      shouldExecute: jest.fn().mockReturnValue(false),
      execute: jest.fn(),
    };

    manager.registerBehavior('monster-1', behaviorA);
    manager.registerBehavior('monster-1', behaviorB);

    const behaviors = manager.getBehaviors('monster-1');
    expect(behaviors).toEqual([behaviorB, behaviorA]);
  });

  it('removes behaviors and returns status', () => {
    const behavior = {
      name: 'test',
      priority: 1,
      shouldExecute: jest.fn().mockReturnValue(false),
      execute: jest.fn(),
    };
    manager.registerBehavior('entity', behavior);

    expect(manager.removeBehavior('entity', 'test')).toBe(true);
    expect(manager.removeBehavior('entity', 'missing')).toBe(false);
    expect(manager.removeBehavior('other', 'test')).toBe(false);
  });

  it('executes behaviors until one succeeds', async () => {
    const context: BehaviorContext = { entity: createMonster() };
    const firstBehavior = {
      name: 'first',
      priority: 2,
      shouldExecute: jest.fn().mockReturnValue(true),
      execute: jest.fn().mockResolvedValue(false),
    };
    const secondBehavior = {
      name: 'second',
      priority: 1,
      shouldExecute: jest.fn().mockReturnValue(true),
      execute: jest.fn().mockResolvedValue(true),
    };
    const thirdBehavior = {
      name: 'third',
      priority: 0,
      shouldExecute: jest.fn().mockReturnValue(true),
      execute: jest.fn().mockResolvedValue(true),
    };

    manager.registerBehavior('entity', thirdBehavior);
    manager.registerBehavior('entity', firstBehavior);
    manager.registerBehavior('entity', secondBehavior);

    await manager.executeBehaviors('entity', context);

    expect(firstBehavior.execute).toHaveBeenCalledTimes(1);
    expect(secondBehavior.execute).toHaveBeenCalledTimes(1);
    expect(thirdBehavior.execute).not.toHaveBeenCalled();
  });

  it('ignores entities without behaviors', async () => {
    const context: BehaviorContext = { entity: createMonster() };
    await expect(
      manager.executeBehaviors('missing', context),
    ).resolves.toBeUndefined();
  });

  it('clears behaviors for an entity', () => {
    const behavior = {
      name: 'cleanup',
      priority: 1,
      shouldExecute: jest.fn().mockReturnValue(false),
      execute: jest.fn(),
    };
    manager.registerBehavior('entity', behavior);

    manager.clearBehaviors('entity');

    expect(manager.getBehaviors('entity')).toEqual([]);
  });
});
