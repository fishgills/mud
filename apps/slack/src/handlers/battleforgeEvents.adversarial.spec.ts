/**
 * Adversarial tests for registerBattleforgeEvents.
 * Tests: wrong channel events, null battleforgeChannelId, missing SlackUser, bot user behavior.
 */

import type { App } from '@slack/bolt';
import { registerBattleforgeEvents } from './battleforgeEvents';
import { getPrismaClient } from '@mud/database';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<
  typeof getPrismaClient
>;

type EventHandler = (args: { event: Record<string, unknown> }) => Promise<void>;

const buildPrisma = (
  overrides: {
    workspaceFindUnique?: jest.Mock;
    slackUserUpdateMany?: jest.Mock;
  } = {},
) => ({
  workspace: {
    findUnique:
      overrides.workspaceFindUnique ?? jest.fn().mockResolvedValue(null),
  },
  slackUser: {
    updateMany:
      overrides.slackUserUpdateMany ??
      jest.fn().mockResolvedValue({ count: 0 }),
  },
});

const buildApp = () => {
  const handlers: Record<string, EventHandler> = {};
  const app = {
    event: jest.fn((eventName: string, handler: EventHandler) => {
      handlers[eventName] = handler;
    }),
  } as unknown as App;
  return { app, handlers };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('registerBattleforgeEvents — adversarial', () => {
  describe('member_joined_channel', () => {
    it('does nothing when event has no team property', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_joined_channel({
        event: { channel: 'C_BATTLEFORGE', user: 'U1' },
      });

      expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('does nothing when team property is not a string', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_joined_channel({
        event: { channel: 'C_BATTLEFORGE', user: 'U1', team: 42 },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('does not write DB when channel does not match battleforgeChannelId', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: 'C_BATTLEFORGE',
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      // User joins a DIFFERENT channel
      await handlers.member_joined_channel({
        event: { channel: 'C_GENERAL', user: 'U1', team: 'T1' },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    /**
     * BUG: The guard is `workspace?.battleforgeChannelId !== event.channel`.
     * When `battleforgeChannelId` is null and `event.channel` is also null,
     * `null !== null` is false — the guard passes and updateMany is called
     * on a workspace that has no configured channel. This is a semantic bug:
     * null-channel workspaces should never match.
     *
     * This test asserts the CORRECT behavior (no DB write) and is EXPECTED TO
     * FAIL on the current implementation when event.channel is null.
     */
    it('[BUG] does not write DB when workspace has battleforgeChannelId: null even if event.channel is null', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: null,
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      // Both battleforgeChannelId and event.channel are null:
      // null !== null is false → guard passes → updateMany IS called (the bug)
      await handlers.member_joined_channel({
        event: { channel: null, user: 'U1', team: 'T1' },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('does not write DB when workspace has battleforgeChannelId: null and event has a real channel', async () => {
      // The guard does correctly skip when channel IDs differ (null !== 'C_REAL')
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: null,
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_joined_channel({
        event: { channel: 'C_REAL', user: 'U1', team: 'T1' },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('does not write DB when workspace is not found', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue(null),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_joined_channel({
        event: { channel: 'C_BATTLEFORGE', user: 'U1', team: 'T_UNKNOWN' },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('calls updateMany with empty match when userId has no SlackUser row (no error expected)', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: 'C_BATTLEFORGE',
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      // User not in SlackUser table — updateMany returns count:0, no throw
      await expect(
        handlers.member_joined_channel({
          event: { channel: 'C_BATTLEFORGE', user: 'U_GHOST', team: 'T1' },
        }),
      ).resolves.toBeUndefined();

      expect(slackUserUpdateMany).toHaveBeenCalledWith({
        where: { teamId: 'T1', userId: 'U_GHOST' },
        data: { inBattleforgeChannel: true },
      });
    });

    it('bot joining the battleforge channel triggers updateMany (bot treated like any user — no special guard)', async () => {
      const BOT_USER_ID = 'UBOT';
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: 'C_BATTLEFORGE',
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_joined_channel({
        event: { channel: 'C_BATTLEFORGE', user: BOT_USER_ID, team: 'T1' },
      });

      // Current implementation does NOT skip bot users — this documents the behavior
      expect(slackUserUpdateMany).toHaveBeenCalledWith({
        where: { teamId: 'T1', userId: BOT_USER_ID },
        data: { inBattleforgeChannel: true },
      });
    });
  });

  describe('member_left_channel', () => {
    it('does nothing when team property is absent', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_left_channel({
        event: { channel: 'C_BATTLEFORGE', user: 'U1' },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('does not write DB when channel does not match battleforgeChannelId', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: 'C_BATTLEFORGE',
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_left_channel({
        event: { channel: 'C_OTHER', user: 'U1', team: 'T1' },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('does not write DB when workspace battleforgeChannelId is null', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: null,
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_left_channel({
        event: { channel: 'C_WHATEVER', user: 'U1', team: 'T1' },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('sets inBattleforgeChannel: false on valid leave event', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: 'C_BATTLEFORGE',
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeEvents(app);

      await handlers.member_left_channel({
        event: { channel: 'C_BATTLEFORGE', user: 'U1', team: 'T1' },
      });

      expect(slackUserUpdateMany).toHaveBeenCalledWith({
        where: { teamId: 'T1', userId: 'U1' },
        data: { inBattleforgeChannel: false },
      });
    });
  });
});
