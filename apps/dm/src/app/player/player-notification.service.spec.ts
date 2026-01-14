import { Logger } from '@nestjs/common';
import { EventBus, type PlayerRespawnEvent } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { PlayerNotificationService } from './player-notification.service';

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    on: jest.fn(),
  },
}));

describe('PlayerNotificationService', () => {
  let service: PlayerNotificationService;
  let eventBridge: { publishPlayerNotification: jest.Mock };
  let listener: ((event: PlayerRespawnEvent) => Promise<void> | void) | null;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    eventBridge = {
      publishPlayerNotification: jest.fn().mockResolvedValue(undefined),
    };

    listener = null;
    (EventBus.on as jest.Mock).mockImplementation((eventType, callback) => {
      if (eventType === 'player:respawn') {
        listener = callback as (event: PlayerRespawnEvent) => Promise<void>;
      }
      return jest.fn();
    });

    service = new PlayerNotificationService(
      eventBridge as unknown as EventBridgeService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it('subscribes to player respawn events on init', () => {
    service.onModuleInit();
    expect(EventBus.on).toHaveBeenCalledWith(
      'player:respawn',
      expect.any(Function),
    );
  });

  it('publishes a player notification when a respawn event has a Slack clientId', async () => {
    service.onModuleInit();
    const event: PlayerRespawnEvent = {
      eventType: 'player:respawn',
      timestamp: new Date(),
      player: {
        id: 1,
        name: 'Test Player',
        slackUser: { teamId: 'T1', userId: 'U1' },
      } as unknown as PlayerRespawnEvent['player'],
    };

    await listener?.(event);

    expect(eventBridge.publishPlayerNotification).toHaveBeenCalledWith(
      event,
      expect.arrayContaining([
        expect.objectContaining({
          clientType: 'slack',
          teamId: 'T1',
          userId: 'U1',
        }),
      ]),
    );
  });

  it('does not publish notification when Slack clientId is missing', async () => {
    service.onModuleInit();
    const event: PlayerRespawnEvent = {
      eventType: 'player:respawn',
      timestamp: new Date(),
      player: {
        id: 2,
        name: 'No Slack',
        slackUser: null,
      } as unknown as PlayerRespawnEvent['player'],
    };

    await listener?.(event);

    expect(eventBridge.publishPlayerNotification).not.toHaveBeenCalled();
  });

  it('cleans up subscriptions on destroy and logs unsubscribe errors', () => {
    const unsubscribeSpy = jest.fn();
    (EventBus.on as jest.Mock).mockImplementationOnce((eventType, callback) => {
      listener = callback as (event: PlayerRespawnEvent) => Promise<void>;
      return unsubscribeSpy;
    });
    service.onModuleInit();

    const failingUnsub = jest.fn(() => {
      throw new Error('boom');
    });
    (service as unknown as { subscriptions: Array<() => void> }).subscriptions.push(
      failingUnsub,
    );

    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    service.onModuleDestroy();

    expect(unsubscribeSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Error unsubscribing from event listener',
      expect.any(Error),
    );
    expect(
      (service as unknown as { subscriptions: Array<() => void> }).subscriptions,
    ).toHaveLength(0);
  });
});
