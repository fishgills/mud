/**
 * Happy-path tests for the battleforge channel post in PlayerNotificationService.
 * Tests the secondary publishPlayerNotification call that posts level-ups to #battleforge.
 */
import { Logger } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import { EventBus, type PlayerLevelUpEvent } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { PlayerNotificationService } from './player-notification.service';
import * as battleforgeModule from '../../shared/battleforge-channel.recipients';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    on: jest.fn(),
  },
}));

jest.mock('../../shared/battleforge-channel.recipients', () => ({
  buildBattleforgeRecipients: jest.fn(),
}));

describe('PlayerNotificationService — battleforge level-up post', () => {
  let service: PlayerNotificationService;
  let eventBridge: { publishPlayerNotification: jest.Mock };
  let listeners: Record<string, (event: PlayerLevelUpEvent) => Promise<void>>;
  let prismaMock: {
    player: { findUnique: jest.Mock };
    guildMember: { findUnique: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    eventBridge = {
      publishPlayerNotification: jest.fn().mockResolvedValue(undefined),
    };

    listeners = {};
    (EventBus.on as jest.Mock).mockImplementation((eventType, callback) => {
      listeners[eventType] = callback as (
        event: PlayerLevelUpEvent,
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
    service.onModuleInit();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts the level-up to #battleforge channels via buildBattleforgeRecipients', async () => {
    const channelRecipients = [
      {
        clientType: 'slack-channel' as const,
        teamId: 'T1',
        channelId: 'C_FORGE',
        message: 'x',
        priority: 'low' as const,
      },
    ];
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue(channelRecipients);

    prismaMock.player.findUnique.mockResolvedValue({
      id: 10,
      name: 'Leveler',
      slackUser: { teamId: 'T1', userId: 'U1' },
    });
    prismaMock.guildMember.findUnique.mockResolvedValue(null);

    const event: PlayerLevelUpEvent = {
      eventType: 'player:levelup',
      timestamp: new Date(),
      player: { id: 10, name: 'Leveler' } as PlayerLevelUpEvent['player'],
      newLevel: 5,
      skillPointsGained: 1,
    };

    await listeners['player:levelup']?.(event);

    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('Leveler'));
    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('level 5'));
    // The channel post is a second call to publishPlayerNotification
    const calls = eventBridge.publishPlayerNotification.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const channelCall = calls.find(
      (args) =>
        Array.isArray(args[1]) &&
        args[1].some(
          (r: { clientType?: string }) => r.clientType === 'slack-channel',
        ),
    );
    expect(channelCall).toBeDefined();
    expect(channelCall![1]).toEqual(channelRecipients);
  });

  it('skips the battleforge post when no channels are configured', async () => {
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue([]);

    prismaMock.player.findUnique.mockResolvedValue({
      id: 11,
      name: 'LoneWolf',
      slackUser: { teamId: 'T2', userId: 'U2' },
    });
    prismaMock.guildMember.findUnique.mockResolvedValue(null);

    const event: PlayerLevelUpEvent = {
      eventType: 'player:levelup',
      timestamp: new Date(),
      player: { id: 11, name: 'LoneWolf' } as PlayerLevelUpEvent['player'],
      newLevel: 3,
      skillPointsGained: 0,
    };

    await listeners['player:levelup']?.(event);

    // publishPlayerNotification is still called once for the DM recipients
    // but NOT a second time for channel (since recipients is empty)
    const calls = eventBridge.publishPlayerNotification.mock.calls;
    const channelCall = calls.find(
      (args) =>
        Array.isArray(args[1]) &&
        args[1].some(
          (r: { clientType?: string }) => r.clientType === 'slack-channel',
        ),
    );
    expect(channelCall).toBeUndefined();
  });
});
