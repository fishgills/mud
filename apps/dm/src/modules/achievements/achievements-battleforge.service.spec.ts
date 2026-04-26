/**
 * Happy-path tests for the AchievementsService#postUnlocksToBattleforge private method,
 * tested via direct invocation on the service instance.
 */
import { Logger } from '@nestjs/common';
import { getPrismaClient, touchWorkspaceActivity } from '@mud/database';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { PlayerService } from '../../app/player/player.service';
import { AchievementsService } from './achievements.service';
import * as battleforgeModule from '../../shared/battleforge-channel.recipients';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
  touchWorkspaceActivity: jest.fn().mockResolvedValue(undefined),
  AchievementConditionType: {
    THRESHOLD: 'THRESHOLD',
    STREAK: 'STREAK',
    RECORD: 'RECORD',
    EVENT: 'EVENT',
  },
  AchievementScope: { PLAYER: 'PLAYER', GUILD: 'GUILD', SEASON: 'SEASON' },
  AchievementCategory: {
    RAID: 'RAID',
    COMBAT: 'COMBAT',
    ECONOMY: 'ECONOMY',
    SOCIAL: 'SOCIAL',
    GUILD: 'GUILD',
    SEASONAL: 'SEASONAL',
    SECRET: 'SECRET',
  },
  AchievementRewardType: {
    NONE: 'NONE',
    TITLE: 'TITLE',
    BADGE: 'BADGE',
    TICKET: 'TICKET',
    COSMETIC: 'COSMETIC',
  },
  RunStatus: { CASHED_OUT: 'CASHED_OUT', FAILED: 'FAILED' },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(
        message: string,
        opts: { code: string; clientVersion: string },
      ) {
        super(message);
        this.code = opts.code;
      }
    },
  },
}));

jest.mock('../../shared/battleforge-channel.recipients', () => ({
  buildBattleforgeRecipients: jest.fn(),
}));

jest.mock('../../app/player/player.service');

describe('AchievementsService — postUnlocksToBattleforge', () => {
  let service: AchievementsService;
  let eventBridge: { publishNotification: jest.Mock };
  let prismaMock: {
    achievementDefinition: { upsert: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    prismaMock = {
      achievementDefinition: {
        upsert: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);
    (touchWorkspaceActivity as jest.Mock).mockResolvedValue(undefined);

    eventBridge = {
      publishNotification: jest.fn().mockResolvedValue(undefined),
    };

    const playerService = {} as PlayerService;
    service = new AchievementsService(
      playerService,
      eventBridge as unknown as EventBridgeService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('posts a channel notification for achievements with broadcastOnUnlock = true', async () => {
    const channelRecipients = [
      {
        clientType: 'slack-channel' as const,
        teamId: 'T1',
        channelId: 'C1',
        message: 'x',
        priority: 'low' as const,
      },
    ];
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue(channelRecipients);

    const unlocked = [
      {
        id: 'ACH1',
        name: 'First Blood',
        description: 'Kill something.',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
    ];

    await (
      service as unknown as {
        postUnlocksToBattleforge: (...args: unknown[]) => Promise<void>;
      }
    ).postUnlocksToBattleforge(42, 'HeroPlayer', unlocked);

    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('HeroPlayer'));
    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).toHaveBeenCalledWith(expect.stringContaining('First Blood'));
    expect(eventBridge.publishNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'announcement',
        recipients: channelRecipients,
      }),
    );
  });

  it('includes all broadcast achievements when multiple unlock at once', async () => {
    const channelRecipients = [
      {
        clientType: 'slack-channel' as const,
        teamId: 'T1',
        channelId: 'C1',
        message: 'x',
        priority: 'low' as const,
      },
    ];
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue(channelRecipients);

    const unlocked = [
      {
        id: 'A1',
        name: 'Ach One',
        description: 'd1',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
      {
        id: 'A2',
        name: 'Ach Two',
        description: 'd2',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
    ];

    await (
      service as unknown as {
        postUnlocksToBattleforge: (...args: unknown[]) => Promise<void>;
      }
    ).postUnlocksToBattleforge(1, 'TwoUnlocks', unlocked);

    const messageArg = (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mock.calls[0][0] as string;
    expect(messageArg).toContain('Ach One');
    expect(messageArg).toContain('Ach Two');
  });

  it('does not call publishNotification when no achievement has broadcastOnUnlock = true', async () => {
    const unlocked = [
      {
        id: 'A3',
        name: 'Quiet One',
        description: 'd',
        broadcastOnUnlock: false,
        broadcastTemplate: null,
      },
    ];

    await (
      service as unknown as {
        postUnlocksToBattleforge: (...args: unknown[]) => Promise<void>;
      }
    ).postUnlocksToBattleforge(1, 'SilentPlayer', unlocked);

    expect(
      battleforgeModule.buildBattleforgeRecipients as jest.Mock,
    ).not.toHaveBeenCalled();
    expect(eventBridge.publishNotification).not.toHaveBeenCalled();
  });

  it('does not call publishNotification when battleforge recipients list is empty', async () => {
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue([]);

    const unlocked = [
      {
        id: 'A4',
        name: 'Broadcast But No Chan',
        description: 'd',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
    ];

    await (
      service as unknown as {
        postUnlocksToBattleforge: (...args: unknown[]) => Promise<void>;
      }
    ).postUnlocksToBattleforge(1, 'Player', unlocked);

    expect(eventBridge.publishNotification).not.toHaveBeenCalled();
  });

  it('only broadcasts achievements that have broadcastOnUnlock = true when mixed', async () => {
    (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mockResolvedValue([
      {
        clientType: 'slack-channel' as const,
        teamId: 'T1',
        channelId: 'C1',
        message: 'x',
        priority: 'low' as const,
      },
    ]);

    const unlocked = [
      {
        id: 'B1',
        name: 'Silent',
        description: 'd',
        broadcastOnUnlock: false,
        broadcastTemplate: null,
      },
      {
        id: 'B2',
        name: 'Loud',
        description: 'd',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
    ];

    await (
      service as unknown as {
        postUnlocksToBattleforge: (...args: unknown[]) => Promise<void>;
      }
    ).postUnlocksToBattleforge(1, 'MixedPlayer', unlocked);

    const messageArg = (
      battleforgeModule.buildBattleforgeRecipients as jest.Mock
    ).mock.calls[0][0] as string;
    expect(messageArg).toContain('Loud');
    expect(messageArg).not.toContain('Silent');
  });
});
