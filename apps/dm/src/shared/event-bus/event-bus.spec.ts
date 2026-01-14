import { EventBus } from './event-bus';
import type { GameEvent } from './game-events';

const combatStartEvent = (overrides?: Partial<GameEvent>): GameEvent =>
  ({
    eventType: 'combat:start',
    timestamp: undefined,
    attacker: { type: 'player', id: 1, name: 'Hero' },
    defender: { type: 'monster', id: 2, name: 'Goblin' },
    ...overrides,
  }) as GameEvent;

describe('EventBus', () => {
  afterEach(() => {
    EventBus.clear();
  });

  it('emits events to specific listeners and supports unsubscribe', async () => {
    const listener = jest.fn();
    const dispose = EventBus.on('combat:start', listener);

    await EventBus.emit(combatStartEvent());

    expect(listener).toHaveBeenCalledTimes(1);
    const payload = listener.mock.calls[0][0];
    expect(payload.timestamp).toBeInstanceOf(Date);

    dispose();
    await EventBus.emit(combatStartEvent());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('invokes wildcard listeners for both async and sync emitters', async () => {
    const wildcard = jest.fn();
    EventBus.onAny(wildcard);

    await EventBus.emit(combatStartEvent());
    expect(wildcard).toHaveBeenCalledTimes(1);

    EventBus.emitSync(combatStartEvent({ eventType: 'combat:start' }));
    expect(wildcard).toHaveBeenCalledTimes(2);
  });

  it('swallows listener errors for emitSync while logging via Logger', () => {
    const faulty = jest.fn(() => {
      throw new Error('boom');
    });
    EventBus.on('combat:start', faulty);

    expect(() => EventBus.emitSync(combatStartEvent())).not.toThrow();
  });

  it('tracks listener counts and event types', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();
    EventBus.on('combat:start', listenerA);
    EventBus.on('player:activity', listenerB);

    expect(EventBus.listenerCount('combat:start')).toBe(1);
    expect(new Set(EventBus.eventTypes())).toEqual(
      new Set(['combat:start', 'player:activity']),
    );

    EventBus.clear();
    expect(EventBus.listenerCount('combat:start')).toBe(0);
    expect(EventBus.eventTypes()).toHaveLength(0);
  });
});
