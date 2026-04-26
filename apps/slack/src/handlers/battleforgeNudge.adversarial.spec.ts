/**
 * Adversarial tests for maybeShowBattleforgePrompt.
 *
 * BUG DOCUMENTED (flagged for reviewer):
 *   lastBattleforgePromptAt is bumped via updateMany BEFORE postMessage is
 *   called. If postMessage throws, the timestamp is already persisted and the
 *   user will not see the prompt for another 7 days. The task spec says the
 *   timestamp should NOT be bumped on failure. See test:
 *   "does not bump lastBattleforgePromptAt when postMessage fails"
 *
 * MISSING WORKSPACE CHECK (flagged for reviewer):
 *   maybeShowBattleforgePrompt never reads workspace.battleforgeChannelId. If
 *   the workspace has no configured channel, the function still sends the
 *   ephemeral. The task spec says it should be a no-op. See test:
 *   "does not post ephemeral when workspace has no battleforgeChannelId"
 */

import { maybeShowBattleforgePrompt } from './battleforgeNudge';
import { getPrismaClient } from '@mud/database';
import type { WebClient } from '@slack/web-api';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<
  typeof getPrismaClient
>;

const NOW = new Date('2026-04-25T12:00:00Z');
const WITHIN_COOLDOWN = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
const OUTSIDE_COOLDOWN = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

const buildPrisma = (
  overrides: {
    slackUserFindUnique?: jest.Mock;
    slackUserUpdateMany?: jest.Mock;
    workspaceFindUnique?: jest.Mock;
  } = {},
) => ({
  slackUser: {
    findUnique:
      overrides.slackUserFindUnique ?? jest.fn().mockResolvedValue(null),
    updateMany:
      overrides.slackUserUpdateMany ??
      jest.fn().mockResolvedValue({ count: 1 }),
  },
  workspace: {
    findUnique:
      overrides.workspaceFindUnique ??
      jest.fn().mockResolvedValue({ battleforgeChannelId: 'C_BATTLEFORGE' }),
  },
});

const buildClient = (
  overrides: {
    conversationsOpen?: jest.Mock;
    chatPostEphemeral?: jest.Mock;
  } = {},
): jest.Mocked<Pick<WebClient, 'conversations' | 'chat'>> =>
  ({
    conversations: {
      open:
        overrides.conversationsOpen ??
        jest.fn().mockResolvedValue({ channel: { id: 'D_CHANNEL' } }),
    },
    chat: {
      postMessage:
        overrides.chatPostEphemeral ??
        jest.fn().mockResolvedValue({ ok: true }),
    },
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('maybeShowBattleforgePrompt — adversarial', () => {
  describe('skip conditions — each independently gates the ephemeral', () => {
    it('no-op when SlackUser row does not exist', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue(null),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient();

      await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

      expect(client.chat.postMessage).not.toHaveBeenCalled();
      expect(prisma.slackUser.updateMany).not.toHaveBeenCalled();
    });

    it('no-op when user is already inBattleforgeChannel: true', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue({
          inBattleforgeChannel: true,
          battleforgePromptDeclined: false,
          lastBattleforgePromptAt: null,
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient();

      await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('no-op when battleforgePromptDeclined: true', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue({
          inBattleforgeChannel: false,
          battleforgePromptDeclined: true,
          lastBattleforgePromptAt: null,
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient();

      await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('no-op when lastBattleforgePromptAt is within 7-day cooldown', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue({
          inBattleforgeChannel: false,
          battleforgePromptDeclined: false,
          lastBattleforgePromptAt: WITHIN_COOLDOWN,
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient();

      await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('sends ephemeral when lastBattleforgePromptAt is exactly outside the 7-day window', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue({
          inBattleforgeChannel: false,
          battleforgePromptDeclined: false,
          lastBattleforgePromptAt: OUTSIDE_COOLDOWN,
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient();

      await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

      expect(client.chat.postMessage).toHaveBeenCalled();
    });
  });

  describe('Slack API failure scenarios', () => {
    it('does not throw when conversations.open fails', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue({
          inBattleforgeChannel: false,
          battleforgePromptDeclined: false,
          lastBattleforgePromptAt: null,
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient({
        conversationsOpen: jest
          .fn()
          .mockRejectedValue(new Error('cannot_dm_bot')),
      });

      await expect(
        maybeShowBattleforgePrompt(client as never, 'T1', 'U1'),
      ).resolves.toBeUndefined();
    });

    it('does not throw when postMessage fails', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue({
          inBattleforgeChannel: false,
          battleforgePromptDeclined: false,
          lastBattleforgePromptAt: null,
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient({
        chatPostEphemeral: jest
          .fn()
          .mockRejectedValue(new Error('channel_not_found')),
      });

      await expect(
        maybeShowBattleforgePrompt(client as never, 'T1', 'U1'),
      ).resolves.toBeUndefined();
    });

    /**
     * BUG: lastBattleforgePromptAt IS bumped before postMessage is called.
     * If postMessage throws, the timestamp persists — the user is silenced
     * for 7 days even though they never saw the prompt.
     *
     * This test asserts the CORRECT intended behavior (timestamp NOT bumped on
     * failure) and is expected to FAIL on the current implementation.
     */
    it('[BUG] does not bump lastBattleforgePromptAt when postMessage fails', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue({
          inBattleforgeChannel: false,
          battleforgePromptDeclined: false,
          lastBattleforgePromptAt: null,
        }),
        slackUserUpdateMany,
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient({
        chatPostEphemeral: jest
          .fn()
          .mockRejectedValue(new Error('channel_not_found')),
      });

      await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

      // Should NOT have bumped the timestamp because the prompt was never shown
      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('no-op when conversations.open returns no channel id', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue({
          inBattleforgeChannel: false,
          battleforgePromptDeclined: false,
          lastBattleforgePromptAt: null,
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient({
        conversationsOpen: jest.fn().mockResolvedValue({ channel: undefined }),
      });

      await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('missing workspace battleforgeChannelId check', () => {
    /**
     * BUG: maybeShowBattleforgePrompt never reads workspace.battleforgeChannelId.
     * If the workspace has no channel configured, it still sends the prompt.
     * The "Join #battleforge" button would then fail when clicked.
     *
     * This test asserts the CORRECT intended behavior (no ephemeral when no
     * channel is configured) and is expected to FAIL on the current implementation
     * because the workspace lookup is entirely absent from the function.
     */
    it('[BUG] does not post ephemeral when workspace has no battleforgeChannelId', async () => {
      const prisma = {
        ...buildPrisma({
          slackUserFindUnique: jest.fn().mockResolvedValue({
            inBattleforgeChannel: false,
            battleforgePromptDeclined: false,
            lastBattleforgePromptAt: null,
          }),
        }),
        workspace: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ battleforgeChannelId: null }),
        },
      };
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient();

      await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('empty / boundary teamId and userId', () => {
    it('handles empty string teamId gracefully', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue(null),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient();

      await expect(
        maybeShowBattleforgePrompt(client as never, '', 'U1'),
      ).resolves.toBeUndefined();

      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });

    it('handles empty string userId gracefully', async () => {
      const prisma = buildPrisma({
        slackUserFindUnique: jest.fn().mockResolvedValue(null),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      const client = buildClient();

      await expect(
        maybeShowBattleforgePrompt(client as never, 'T1', ''),
      ).resolves.toBeUndefined();

      expect(client.chat.postMessage).not.toHaveBeenCalled();
    });
  });
});
