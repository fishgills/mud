import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { BehaviorContext } from '../behaviors/behavior.interface';
import { AggressiveBehavior } from '../behaviors/aggressive.behavior';
import { PatrolBehavior } from '../behaviors/patrol.behavior';
import { RandomMovementBehavior } from '../behaviors/random-movement.behavior';
import { MonsterEntity } from '../entities/monster-entity';
import { NpcEntity } from '../entities/npc-entity';

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

const createNpc = () =>
  new NpcEntity({
    id: 1,
    name: 'Guard',
    role: 'guard',
    attributes: { strength: 12, agility: 10, health: 12 },
    combat: { hp: 30, maxHp: 30, isAlive: true },
    position: { x: 0, y: 0 },
    settlementId: 1,
    dialogue: 'Stay safe.',
    isHostile: false,
  });

describe('AggressiveBehavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('only executes for monsters with nearby players in range', async () => {
    const monster = createMonster();
    const behavior = new AggressiveBehavior(2);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const context: BehaviorContext = {
      entity: monster,
      nearbyPlayers: [
        { id: 1, name: 'Hero', distance: 1 },
        { id: 2, name: 'Rogue', distance: 3 },
      ],
    };

    expect(behavior.shouldExecute(context)).toBe(true);
    await expect(behavior.execute(context)).resolves.toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith(
      `${monster.name} is aggressive towards player Hero`,
    );
  });

  it('does not execute when out of range or wrong entity', async () => {
    const monster = createMonster();
    const npc = createNpc();
    const behavior = new AggressiveBehavior(1);

    const outOfRangeContext: BehaviorContext = {
      entity: monster,
      nearbyPlayers: [{ id: 1, name: 'Hero', distance: 5 }],
    };
    const npcContext: BehaviorContext = { entity: npc };

    expect(behavior.shouldExecute(outOfRangeContext)).toBe(false);
    expect(behavior.shouldExecute(npcContext)).toBe(false);
    await expect(behavior.execute({ entity: npc })).resolves.toBe(false);
  });
});

describe('PatrolBehavior', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves NPCs along patrol path after waiting period', async () => {
    const npc = createNpc();
    const behavior = new PatrolBehavior(
      [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      1000,
    );

    const context: BehaviorContext = { entity: npc };

    jest.setSystemTime(new Date('2024-01-01T00:00:01Z'));
    expect(behavior.shouldExecute(context)).toBe(true);

    await expect(behavior.execute(context)).resolves.toBe(true);
    expect(npc.position).toEqual({ x: 1, y: 0 });

    jest.setSystemTime(new Date('2024-01-01T00:00:02Z'));
    expect(behavior.shouldExecute(context)).toBe(true);

    await expect(behavior.execute(context)).resolves.toBe(false);

    jest.setSystemTime(new Date('2024-01-01T00:00:03Z'));
    expect(behavior.shouldExecute(context)).toBe(true);
    await behavior.execute(context);
    expect(npc.position).toEqual({ x: 1, y: 1 });
  });

  it('does not execute for non-NPC entities', () => {
    const monster = createMonster();
    const behavior = new PatrolBehavior([{ x: 1, y: 0 }], 1000);
    const context: BehaviorContext = { entity: monster };

    jest.setSystemTime(new Date('2024-01-01T00:00:02Z'));
    expect(behavior.shouldExecute(context)).toBe(false);
  });
});

describe('RandomMovementBehavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('moves monster randomly when chance succeeds', async () => {
    const monster = createMonster();
    monster.lastMove = new Date('2023-12-31T23:59:00Z');
    const behavior = new RandomMovementBehavior(0.5, 30);
    const context: BehaviorContext = { entity: monster };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.4); // execute
    randomSpy.mockReturnValueOnce(0.75); // choose west

    await expect(behavior.execute(context)).resolves.toBe(true);
    expect(monster.position).toEqual({ x: -1, y: 0 });
    expect(monster.lastMove.getTime()).toBeGreaterThan(
      new Date('2023-12-31T23:59:00Z').getTime(),
    );
  });

  it('does not execute when chance fails or entity is not a monster', async () => {
    const monster = createMonster();
    const behavior = new RandomMovementBehavior(0.5, 30);
    const context: BehaviorContext = { entity: monster };

    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    await expect(behavior.execute(context)).resolves.toBe(false);

    const npc = createNpc();
    expect(behavior.shouldExecute({ entity: npc })).toBe(false);
  });
});
