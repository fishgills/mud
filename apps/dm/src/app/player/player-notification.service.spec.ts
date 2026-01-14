import { Logger } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import {
  EventBus,
  type PlayerLevelUpEvent,
  type PlayerRespawnEvent,
} from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { PlayerNotificationService } from './player-notification.service';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    on: jest.fn(),
  },
}));

describe('PlayerNotificationService', () => {
  let service: PlayerNotificationService;
  let eventBridge: { publishPlayerNotification: jest.Mock };
  let listeners: Record<
    string,
    ((event: PlayerRespawnEvent | PlayerLevelUpEvent) => Promise<void> | void)
  >;
  let prismaMock: {
    player: { findUnique: jest.Mock };
    guildMember: { findUnique: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    eventBridge = {
      publishPlayerNotification: jest.fn().mockResolvedValue(undefined),
    };

    listeners = {};
    (EventBus.on as jest.Mock).mockImplementation((eventType, callback) => {
      listeners[eventType] = callback as (
        event: PlayerRespawnEvent | PlayerLevelUpEvent,
      ) => Promise<void>;
      return jest.fn();
    });

    prismaMock = {
      player: { findUnique: jest.fn() },
      guildMember: { findUnique: jest.fn(), findMany: jest.fn() },
    };
    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);

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
    expect(EventBus.on).toHaveBeenCalledWith(
      'player:levelup',
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

    await listeners['player:respawn']?.(event);

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

    await listeners['player:respawn']?.(event);

    expect(eventBridge.publishPlayerNotification).not.toHaveBeenCalled();
  });

  it('publishes a player notification for level ups without a guild', async () => {
    service.onModuleInit();
    const event: PlayerLevelUpEvent = {
      eventType: 'player:levelup',
      timestamp: new Date(),
      player: { id: 10, name: 'Leveler' } as PlayerLevelUpEvent['player'],
      newLevel: 4,
      skillPointsGained: 1,
    };

    prismaMock.player.findUnique.mockResolvedValue({
      id: 10,
      name: 'Leveler',
      slackUser: { teamId: 'T1', userId: 'U1' },
    });
    prismaMock.guildMember.findUnique.mockResolvedValue(null);

    await listeners['player:levelup']?.(event);

    expect(eventBridge.publishPlayerNotification).toHaveBeenCalledWith(
      event,
      expect.arrayContaining([
        expect.objectContaining({
          clientType: 'slack',
          teamId: 'T1',
          userId: 'U1',
          message: expect.stringContaining('level 4'),
        }),
      ]),
    );
  });

  it('notifies guild members when a player levels up', async () => {
    service.onModuleInit();
    const event: PlayerLevelUpEvent = {
      eventType: 'player:levelup',
      timestamp: new Date(),
      player: { id: 11, name: 'Guildie' } as PlayerLevelUpEvent['player'],
      newLevel: 7,
      skillPointsGained: 0,
    };

    prismaMock.player.findUnique.mockResolvedValue({
      id: 11,
      name: 'Guildie',
      slackUser: { teamId: 'T2', userId: 'U2' },
    });
    prismaMock.guildMember.findUnique.mockResolvedValue({
      guildId: 99,
    });
    prismaMock.guildMember.findMany.mockResolvedValue([
      {
        player: {
          id: 11,
          name: 'Guildie',
          slackUser: { teamId: 'T2', userId: 'U2' },
        },
      },
      {
        player: {
          id: 12,
          name: 'Ally',
          slackUser: { teamId: 'T2', userId: 'U3' },
        },
      },
    ]);

    await listeners['player:levelup']?.(event);

    expect(eventBridge.publishPlayerNotification).toHaveBeenCalledWith(
      event,
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'U2',
        }),
        expect.objectContaining({
          userId: 'U3',
          message: expect.stringContaining('Guildie'),
        }),
      ]),
    );
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
