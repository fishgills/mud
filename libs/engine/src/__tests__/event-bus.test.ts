import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { EventBus } from '../events/event-bus';
import { PlayerSpawnEvent } from '../events/game-events';

describe('EventBus', () => {
  const baseEvent: PlayerSpawnEvent = {
    eventType: 'player:spawn',
    player: {
      id: 1,
      name: 'Hero',
      clientId: 'slack:U1',
      clientType: 'slack',
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      strength: 10,
      agility: 10,
      health: 10,
      level: 1,
      skillPoints: 0,
      gold: 0,
      xp: 0,
      isAlive: true,
      lastAction: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    x: 0,
    y: 0,
    timestamp: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    EventBus.clear();
  });

  afterEach(() => {
    EventBus.clear();
    jest.restoreAllMocks();
  });

  it('registers and emits events to listeners', async () => {
    const listener = jest.fn();
    const unsubscribe = EventBus.on('player:spawn', listener);

    await EventBus.emit(baseEvent);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(baseEvent);

    unsubscribe();
    await EventBus.emit(baseEvent);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports wildcard listeners', async () => {
    const wildcardListener = jest.fn();
    const specificListener = jest.fn();

    const unsubscribeAny = EventBus.onAny(wildcardListener);
    EventBus.on('player:spawn', specificListener);

    await EventBus.emit({
      ...baseEvent,
      timestamp: undefined as unknown as Date,
    });

    expect(specificListener).toHaveBeenCalledTimes(1);
    expect(wildcardListener).toHaveBeenCalledTimes(1);
    expect(wildcardListener.mock.calls[0][0].timestamp).toBeInstanceOf(Date);

    unsubscribeAny();
    await EventBus.emit(baseEvent);

    expect(wildcardListener).toHaveBeenCalledTimes(1);
  });

  it('handles synchronous emission and errors gracefully', () => {
    const error = new Error('listener failure');
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const goodListener = jest.fn();

    EventBus.on('player:spawn', () => {
      throw error;
    });
    EventBus.on('player:spawn', goodListener);

    EventBus.emitSync({
      ...baseEvent,
      timestamp: undefined as unknown as Date,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error in event listener for player:spawn:',
      error,
    );
    expect(goodListener).toHaveBeenCalledTimes(1);
  });

  it('handles wildcard errors in synchronous emission', () => {
    const error = new Error('wildcard failure');
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    EventBus.onAny(() => {
      throw error;
    });

    EventBus.emitSync(baseEvent);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error in wildcard event listener:',
      error,
    );
  });

  it('tracks listener counts and event types', () => {
    const listener = jest.fn();
    EventBus.on('player:spawn', listener);

    expect(EventBus.listenerCount('player:spawn')).toBe(1);
    expect(EventBus.listenerCount('player:move')).toBe(0);
    expect(EventBus.eventTypes()).toEqual(['player:spawn']);

    EventBus.clear();

    expect(EventBus.listenerCount('player:spawn')).toBe(0);
    expect(EventBus.eventTypes()).toEqual([]);
  });
});
