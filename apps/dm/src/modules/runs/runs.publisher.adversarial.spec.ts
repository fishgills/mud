/**
 * Adversarial tests for RunsPublisher.handleRunEnd.
 */

import { Test } from '@nestjs/testing';
import { RunsPublisher } from './runs.publisher';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { EventBus } from '../../shared/event-bus';
import { buildBattleforgeRecipients } from '../../shared/battleforge-channel.recipients';
import { getPrismaClient } from '@mud/database';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
  RunStatus: {
    ACTIVE: 'ACTIVE',
    CASHED_OUT: 'CASHED_OUT',
    FAILED: 'FAILED',
  },
}));

jest.mock('../../shared/battleforge-channel.recipients', () => ({
  buildBattleforgeRecipients: jest.fn(),
}));

const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<
  typeof getPrismaClient
>;
const mockedBuildBattleforgeRecipients =
  buildBattleforgeRecipients as jest.MockedFunction<
    typeof buildBattleforgeRecipients
  >;

const buildPrisma = (
  overrides: {
    guildFindUnique?: jest.Mock;
    runParticipantFindMany?: jest.Mock;
  } = {},
) => ({
  guild: {
    findUnique: overrides.guildFindUnique ?? jest.fn().mockResolvedValue(null),
  },
  runParticipant: {
    findMany:
      overrides.runParticipantFindMany ?? jest.fn().mockResolvedValue([]),
  },
});

const makeEventBridge = () => ({
  publishNotification: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RunsPublisher — adversarial', () => {
  let publisher: RunsPublisher | undefined;

  const buildPublisher = async (
    prismaOverrides: Parameters<typeof buildPrisma>[0] = {},
  ) => {
    const eb = makeEventBridge();
    const prisma = buildPrisma(prismaOverrides);
    mockedGetPrismaClient.mockReturnValue(prisma as never);

    const module = await Test.createTestingModule({
      providers: [RunsPublisher, { provide: EventBridgeService, useValue: eb }],
    }).compile();

    const pub = module.get(RunsPublisher);
    pub.onModuleInit();
    return { publisher: pub, eventBridge: eb, prisma };
  };

  afterEach(() => {
    publisher?.onModuleDestroy();
    publisher = undefined;
  });

  const emitRunEnd = (overrides: Record<string, unknown> = {}) =>
    EventBus.emit({
      eventType: 'run:end' as never,
      runId: 1,
      guildId: undefined,
      status: 'CASHED_OUT',
      bankedXp: 100,
      bankedGold: 50,
      ...overrides,
    } as never);

  describe('non-CASHED_OUT statuses', () => {
    it('does not query participants or post for FAILED status', async () => {
      const {
        publisher: pub,
        prisma,
        eventBridge: eb,
      } = await buildPublisher({
        runParticipantFindMany: jest.fn().mockResolvedValue([]),
      });
      publisher = pub;
      mockedBuildBattleforgeRecipients.mockResolvedValue([]);

      await emitRunEnd({ status: 'FAILED' });

      expect(prisma.runParticipant.findMany).not.toHaveBeenCalled();
      expect(mockedBuildBattleforgeRecipients).not.toHaveBeenCalled();
      expect(eb.publishNotification).not.toHaveBeenCalled();
    });

    it('does not post for ACTIVE status', async () => {
      const {
        publisher: pub,
        prisma,
        eventBridge: eb,
      } = await buildPublisher({
        runParticipantFindMany: jest.fn(),
      });
      publisher = pub;

      await emitRunEnd({ status: 'ACTIVE' });

      expect(prisma.runParticipant.findMany).not.toHaveBeenCalled();
      expect(eb.publishNotification).not.toHaveBeenCalled();
    });

    it('does not post for an unknown status string', async () => {
      const { publisher: pub, prisma } = await buildPublisher({
        runParticipantFindMany: jest.fn(),
      });
      publisher = pub;

      await emitRunEnd({ status: 'ABANDONED' });

      expect(prisma.runParticipant.findMany).not.toHaveBeenCalled();
      expect(mockedBuildBattleforgeRecipients).not.toHaveBeenCalled();
    });
  });

  describe('guild fallback label', () => {
    it('uses "A party" when guildId is undefined', async () => {
      const { publisher: pub } = await buildPublisher({
        runParticipantFindMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      });
      publisher = pub;
      mockedBuildBattleforgeRecipients.mockResolvedValue([
        {
          clientType: 'slack-channel',
          teamId: 'T1',
          channelId: 'C1',
          message: '',
          priority: 'low',
        },
      ]);

      await emitRunEnd({ guildId: undefined });

      expect(mockedBuildBattleforgeRecipients).toHaveBeenCalledWith(
        expect.stringContaining('A party'),
      );
    });

    it('uses "A party" when guild row is not found in DB', async () => {
      const { publisher: pub } = await buildPublisher({
        guildFindUnique: jest.fn().mockResolvedValue(null),
        runParticipantFindMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      });
      publisher = pub;
      mockedBuildBattleforgeRecipients.mockResolvedValue([
        {
          clientType: 'slack-channel',
          teamId: 'T1',
          channelId: 'C1',
          message: '',
          priority: 'low',
        },
      ]);

      await emitRunEnd({ guildId: 999, status: 'CASHED_OUT' });

      expect(mockedBuildBattleforgeRecipients).toHaveBeenCalledWith(
        expect.stringContaining('A party'),
      );
    });
  });

  describe('empty recipients', () => {
    it('does not call publishNotification when buildBattleforgeRecipients returns empty', async () => {
      const { publisher: pub, eventBridge: eb } = await buildPublisher({
        runParticipantFindMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      });
      publisher = pub;
      mockedBuildBattleforgeRecipients.mockResolvedValue([]);

      await emitRunEnd({ status: 'CASHED_OUT' });

      expect(eb.publishNotification).not.toHaveBeenCalled();
    });
  });

  describe('participant count edge cases', () => {
    it('omits count suffix when only one participant', async () => {
      const { publisher: pub } = await buildPublisher({
        guildFindUnique: jest.fn().mockResolvedValue({ name: 'Iron Wolves' }),
        runParticipantFindMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      });
      publisher = pub;
      mockedBuildBattleforgeRecipients.mockResolvedValue([
        {
          clientType: 'slack-channel',
          teamId: 'T1',
          channelId: 'C1',
          message: '',
          priority: 'low',
        },
      ]);

      await emitRunEnd({ guildId: 1, status: 'CASHED_OUT' });

      const calledMessage = mockedBuildBattleforgeRecipients.mock.calls[0][0];
      expect(calledMessage).not.toContain('members');
    });

    it('includes member count in message when multiple participants', async () => {
      const { publisher: pub } = await buildPublisher({
        guildFindUnique: jest.fn().mockResolvedValue({ name: 'Iron Wolves' }),
        runParticipantFindMany: jest
          .fn()
          .mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]),
      });
      publisher = pub;
      mockedBuildBattleforgeRecipients.mockResolvedValue([
        {
          clientType: 'slack-channel',
          teamId: 'T1',
          channelId: 'C1',
          message: '',
          priority: 'low',
        },
      ]);

      await emitRunEnd({ guildId: 1, status: 'CASHED_OUT' });

      const calledMessage = mockedBuildBattleforgeRecipients.mock.calls[0][0];
      expect(calledMessage).toContain('3 members');
    });

    it('handles zero participants without throwing', async () => {
      const { publisher: pub } = await buildPublisher({
        runParticipantFindMany: jest.fn().mockResolvedValue([]),
      });
      publisher = pub;
      mockedBuildBattleforgeRecipients.mockResolvedValue([]);

      await expect(
        emitRunEnd({ status: 'CASHED_OUT' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('error resilience', () => {
    it('does not throw when buildBattleforgeRecipients rejects', async () => {
      const { publisher: pub } = await buildPublisher({
        runParticipantFindMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      });
      publisher = pub;
      mockedBuildBattleforgeRecipients.mockRejectedValue(new Error('DB error'));

      await expect(
        emitRunEnd({ status: 'CASHED_OUT' }),
      ).resolves.toBeUndefined();
    });
  });
});
