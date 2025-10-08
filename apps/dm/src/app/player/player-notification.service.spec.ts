import { Logger } from '@nestjs/common';
import { EventBus, type PlayerRespawnEvent } from '@mud/engine';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { PlayerNotificationService } from './player-notification.service';

jest.mock('@mud/engine', () => ({
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

  it('publishes a player notification when a respawn event has a Slack ID', async () => {
    service.onModuleInit();
    const event: PlayerRespawnEvent = {
      eventType: 'player:respawn',
      timestamp: new Date(),
      player: {
        id: 1,
        name: 'Test Player',
        slackId: 'U123',
      } as unknown as PlayerRespawnEvent['player'],
      x: 10,
      y: 20,
    };

    await listener?.(event);

    expect(eventBridge.publishPlayerNotification).toHaveBeenCalledWith(
      event,
      expect.arrayContaining([
        expect.objectContaining({
          clientType: 'slack',
          clientId: 'slack:U123',
          message: expect.stringContaining('respawned'),
        }),
      ]),
    );
  });

  it('does not publish notification when Slack ID is missing', async () => {
    service.onModuleInit();
    const event: PlayerRespawnEvent = {
      eventType: 'player:respawn',
      timestamp: new Date(),
      player: {
        id: 2,
        name: 'No Slack',
        slackId: null,
      } as unknown as PlayerRespawnEvent['player'],
      x: 5,
      y: 7,
    };

    await listener?.(event);

    expect(eventBridge.publishPlayerNotification).not.toHaveBeenCalled();
  });
});
