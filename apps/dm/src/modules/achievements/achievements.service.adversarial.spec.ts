/**
 * Adversarial tests for AchievementsService.postUnlocksToBattleforge.
 * Focused on: broadcast filter, mixed broadcast/no-broadcast, empty inputs.
 */

import { buildBattleforgeRecipients } from '../../shared/battleforge-channel.recipients';

jest.mock('../../shared/battleforge-channel.recipients', () => ({
  buildBattleforgeRecipients: jest.fn(),
}));

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(() => ({
    achievementDefinition: { upsert: jest.fn().mockResolvedValue({}) },
    playerAchievementStats: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    playerAchievementUnlock: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    },
    workspaceBroadcastConfig: {
      upsert: jest.fn().mockResolvedValue({
        enabled: false,
        channelId: null,
        perPlayerCooldownSeconds: 3600,
        globalCooldownSeconds: 120,
      }),
    },
    achievementBroadcastLog: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        playerAchievementUnlock: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({}),
        },
        playerAchievementStats: {
          update: jest.fn().mockResolvedValue({}),
        },
      }),
    ),
  })),
  AchievementConditionType: {
    THRESHOLD: 'THRESHOLD',
    STREAK: 'STREAK',
    RECORD: 'RECORD',
    EVENT: 'EVENT',
  },
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
    GOLD: 'GOLD',
    XP: 'XP',
    ITEM: 'ITEM',
  },
  AchievementScope: { PLAYER: 'PLAYER', WORKSPACE: 'WORKSPACE' },
  RunStatus: { CASHED_OUT: 'CASHED_OUT', FAILED: 'FAILED' },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, meta: { code: string }) {
        super(message);
        this.code = meta.code;
      }
    },
  },
  touchWorkspaceActivity: jest.fn().mockResolvedValue(undefined),
}));

const mockedBuildBattleforgeRecipients =
  buildBattleforgeRecipients as jest.MockedFunction<
    typeof buildBattleforgeRecipients
  >;

// We test postUnlocksToBattleforge indirectly by importing the module and
// calling the private method via casting. We use a factory to build a partial
// instance sufficient for the test.

import { EventBridgeService } from '../../shared/event-bridge.service';

// Minimal stub — only what postUnlocksToBattleforge touches
const buildService = () => {
  const eventBridge = {
    publishNotification: jest.fn().mockResolvedValue(undefined),
  } as unknown as EventBridgeService;

  // We call postUnlocksToBattleforge directly without NestJS DI
  // by importing the class and constructing it with stubs.
  // PlayerService is only needed for other methods; pass a stub.
  const playerServiceStub = {} as never;

  // Lazy import to avoid module-level init side effects
  const { AchievementsService } = require('./achievements.service') as {
    AchievementsService: new (
      playerService: never,
      eventBridge: EventBridgeService,
    ) => {
      postUnlocksToBattleforge: (
        id: number,
        name: string,
        unlocked: unknown[],
      ) => Promise<void>;
    };
  };

  const service = new AchievementsService(playerServiceStub, eventBridge);
  // Access private method via cast
  const callPostUnlocks = (
    playerId: number,
    playerName: string,
    unlocked: Array<{
      id: string;
      name: string;
      description: string;
      broadcastOnUnlock: boolean;
      broadcastTemplate: string | null;
    }>,
  ) =>
    (
      service as unknown as {
        postUnlocksToBattleforge: typeof service.postUnlocksToBattleforge;
      }
    ).postUnlocksToBattleforge(playerId, playerName, unlocked);

  return { service, eventBridge, callPostUnlocks };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AchievementsService.postUnlocksToBattleforge — adversarial', () => {
  it('does not post when all unlocked achievements have broadcastOnUnlock: false', async () => {
    mockedBuildBattleforgeRecipients.mockResolvedValue([]);
    const { callPostUnlocks, eventBridge } = buildService();

    await callPostUnlocks(1, 'Thorin', [
      {
        id: 'A1',
        name: 'First Blood',
        description: 'Kill something',
        broadcastOnUnlock: false,
        broadcastTemplate: null,
      },
      {
        id: 'A2',
        name: 'Shopaholic',
        description: 'Spend gold',
        broadcastOnUnlock: false,
        broadcastTemplate: null,
      },
    ]);

    expect(mockedBuildBattleforgeRecipients).not.toHaveBeenCalled();
    expect(
      (eventBridge as { publishNotification: jest.Mock }).publishNotification,
    ).not.toHaveBeenCalled();
  });

  it('posts only broadcast achievements when mix of broadcast:true and broadcast:false', async () => {
    mockedBuildBattleforgeRecipients.mockResolvedValue([
      {
        clientType: 'slack-channel',
        teamId: 'T1',
        channelId: 'C1',
        message: '',
        priority: 'low',
      },
    ]);

    const { callPostUnlocks } = buildService();

    await callPostUnlocks(1, 'Thorin', [
      {
        id: 'A1',
        name: 'First Blood',
        description: 'Kill something',
        broadcastOnUnlock: false,
        broadcastTemplate: null,
      },
      {
        id: 'A2',
        name: 'Legendary Haul',
        description: 'Earn a lot of gold',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
    ]);

    const calledMessage = mockedBuildBattleforgeRecipients.mock.calls[0][0];
    expect(calledMessage).toContain('Legendary Haul');
    expect(calledMessage).not.toContain('First Blood');
  });

  it('does not post when unlocked array is empty', async () => {
    const { callPostUnlocks, eventBridge } = buildService();

    await callPostUnlocks(1, 'Thorin', []);

    expect(mockedBuildBattleforgeRecipients).not.toHaveBeenCalled();
    expect(
      (eventBridge as { publishNotification: jest.Mock }).publishNotification,
    ).not.toHaveBeenCalled();
  });

  it('does not post when no workspace has battleforgeChannelId (empty recipients)', async () => {
    mockedBuildBattleforgeRecipients.mockResolvedValue([]);
    const { callPostUnlocks, eventBridge } = buildService();

    await callPostUnlocks(1, 'Thorin', [
      {
        id: 'A1',
        name: 'Legendary Haul',
        description: 'Big gold',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
    ]);

    expect(mockedBuildBattleforgeRecipients).toHaveBeenCalled();
    expect(
      (eventBridge as { publishNotification: jest.Mock }).publishNotification,
    ).not.toHaveBeenCalled();
  });

  it('handles multiple broadcast achievements in single post', async () => {
    mockedBuildBattleforgeRecipients.mockResolvedValue([
      {
        clientType: 'slack-channel',
        teamId: 'T1',
        channelId: 'C1',
        message: '',
        priority: 'low',
      },
    ]);

    const { callPostUnlocks, eventBridge } = buildService();

    await callPostUnlocks(1, 'Thorin', [
      {
        id: 'A1',
        name: 'Veteran',
        description: '100 raids',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
      {
        id: 'A2',
        name: 'Legendary Haul',
        description: 'Big gold',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
    ]);

    // Only one publishNotification call for all broadcasts combined
    expect(
      (eventBridge as { publishNotification: jest.Mock }).publishNotification,
    ).toHaveBeenCalledTimes(1);
    const calledMessage = mockedBuildBattleforgeRecipients.mock.calls[0][0];
    expect(calledMessage).toContain('Veteran');
    expect(calledMessage).toContain('Legendary Haul');
  });

  it('handles player name with special Slack characters without double-escaping', async () => {
    mockedBuildBattleforgeRecipients.mockResolvedValue([
      {
        clientType: 'slack-channel',
        teamId: 'T1',
        channelId: 'C1',
        message: '',
        priority: 'low',
      },
    ]);
    const { callPostUnlocks } = buildService();

    await callPostUnlocks(1, '<Thorin & Gimli>', [
      {
        id: 'A1',
        name: 'Bold Move',
        description: 'desc',
        broadcastOnUnlock: true,
        broadcastTemplate: null,
      },
    ]);

    const calledMessage = mockedBuildBattleforgeRecipients.mock.calls[0][0];
    expect(calledMessage).toContain('<Thorin & Gimli>');
  });
});
