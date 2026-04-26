/**
 * Adversarial tests for registerBattleforgeActions.
 *
 * BUG DOCUMENTED (flagged for reviewer):
 *   battleforge:join — when conversations.invite throws (e.g., already_in_channel),
 *   the catch block at line 52 swallows the error but also skips BOTH the DB
 *   update and the respond call. The task spec says `already_in_channel` should
 *   still mark inBattleforgeChannel: true and surface success to the user.
 *   See test: "[BUG] marks inBattleforgeChannel true and responds success when invite returns already_in_channel"
 */

import type { App, RespondFn } from '@slack/bolt';
import {
  registerBattleforgeActions,
  BATTLEFORGE_ACTIONS,
} from './battleforgeActions';
import { getPrismaClient } from '@mud/database';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<
  typeof getPrismaClient
>;

type ActionHandler = (args: {
  ack: jest.Mock;
  body: Record<string, unknown>;
  client: {
    conversations: { invite: jest.Mock };
    chat: { update: jest.Mock };
  };
  context: Record<string, unknown>;
  respond: jest.Mock;
  logger: { warn: jest.Mock };
}) => Promise<void>;

const buildPrisma = (
  overrides: {
    workspaceFindUnique?: jest.Mock;
    slackUserUpdateMany?: jest.Mock;
  } = {},
) => ({
  workspace: {
    findUnique:
      overrides.workspaceFindUnique ??
      jest.fn().mockResolvedValue({ battleforgeChannelId: 'C_BATTLEFORGE' }),
  },
  slackUser: {
    updateMany:
      overrides.slackUserUpdateMany ??
      jest.fn().mockResolvedValue({ count: 1 }),
  },
});

const buildApp = () => {
  const handlers: Record<string, ActionHandler> = {};
  const app = {
    action: jest.fn((actionId: string, handler: ActionHandler) => {
      handlers[actionId] = handler;
    }),
  } as unknown as App;
  return { app, handlers };
};

const makeBaseBody = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'U1', team_id: 'T1' },
  team: { id: 'T1' },
  ...overrides,
});

const makeClient = (
  overrides: {
    conversationsInvite?: jest.Mock;
  } = {},
) => ({
  conversations: {
    invite:
      overrides.conversationsInvite ??
      jest.fn().mockResolvedValue({ ok: true }),
  },
  chat: { update: jest.fn().mockResolvedValue(undefined) },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('registerBattleforgeActions — adversarial', () => {
  describe('battleforge:join', () => {
    it('returns early without DB call when userId is missing', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await handlers[BATTLEFORGE_ACTIONS.JOIN]({
        ack: jest.fn().mockResolvedValue(undefined),
        body: makeBaseBody({ user: undefined }),
        client: makeClient() as never,
        context: {},
        respond: jest.fn(),
        logger: { warn: jest.fn() },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('returns early without DB call when teamId is missing', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await handlers[BATTLEFORGE_ACTIONS.JOIN]({
        ack: jest.fn().mockResolvedValue(undefined),
        body: { user: { id: 'U1' } },
        client: makeClient() as never,
        context: {},
        respond: jest.fn(),
        logger: { warn: jest.fn() },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('returns early without invite when workspace has no battleforgeChannelId', async () => {
      const conversationsInvite = jest.fn();
      const prisma = buildPrisma({
        workspaceFindUnique: jest
          .fn()
          .mockResolvedValue({ battleforgeChannelId: null }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await handlers[BATTLEFORGE_ACTIONS.JOIN]({
        ack: jest.fn().mockResolvedValue(undefined),
        body: makeBaseBody(),
        client: makeClient({ conversationsInvite }) as never,
        context: { teamId: 'T1' },
        respond: jest.fn(),
        logger: { warn: jest.fn() },
      });

      expect(conversationsInvite).not.toHaveBeenCalled();
    });

    it('returns early when workspace is not found', async () => {
      const conversationsInvite = jest.fn();
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue(null),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await handlers[BATTLEFORGE_ACTIONS.JOIN]({
        ack: jest.fn().mockResolvedValue(undefined),
        body: makeBaseBody(),
        client: makeClient({ conversationsInvite }) as never,
        context: { teamId: 'T1' },
        respond: jest.fn(),
        logger: { warn: jest.fn() },
      });

      expect(conversationsInvite).not.toHaveBeenCalled();
    });

    /**
     * BUG: When conversations.invite throws (including already_in_channel),
     * the catch block swallows the error and skips both DB update and respond.
     * Task spec says: already_in_channel → still mark inBattleforgeChannel: true
     * and surface success to the user.
     *
     * This test asserts the CORRECT intended behavior and is EXPECTED TO FAIL
     * on the current implementation.
     */
    it('[BUG] marks inBattleforgeChannel true and responds success when invite returns already_in_channel', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const alreadyInChannelError = new Error('already_in_channel');
      (alreadyInChannelError as { data?: { error?: string } }).data = {
        error: 'already_in_channel',
      };

      const respond = jest.fn().mockResolvedValue(undefined);
      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await handlers[BATTLEFORGE_ACTIONS.JOIN]({
        ack: jest.fn().mockResolvedValue(undefined),
        body: makeBaseBody(),
        client: makeClient({
          conversationsInvite: jest
            .fn()
            .mockRejectedValue(alreadyInChannelError),
        }) as never,
        context: { teamId: 'T1' },
        respond: respond as RespondFn,
        logger: { warn: jest.fn() },
      });

      // Should have updated DB and responded with success despite the "error"
      expect(slackUserUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { inBattleforgeChannel: true } }),
      );
      expect(respond).toHaveBeenCalledWith(
        expect.objectContaining({ replace_original: true }),
      );
    });

    it('is idempotent — clicking join when already joined does not throw', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      const invoke = () =>
        handlers[BATTLEFORGE_ACTIONS.JOIN]({
          ack: jest.fn().mockResolvedValue(undefined),
          body: makeBaseBody(),
          client: makeClient() as never,
          context: { teamId: 'T1' },
          respond: jest.fn().mockResolvedValue(undefined),
          logger: { warn: jest.fn() },
        });

      await expect(invoke()).resolves.toBeUndefined();
      await expect(invoke()).resolves.toBeUndefined();
    });

    it('swallows error and does not throw when channel is archived', async () => {
      const prisma = buildPrisma();
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const archivedError = new Error('is_archived');
      (archivedError as { data?: { error?: string } }).data = {
        error: 'is_archived',
      };

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await expect(
        handlers[BATTLEFORGE_ACTIONS.JOIN]({
          ack: jest.fn().mockResolvedValue(undefined),
          body: makeBaseBody(),
          client: makeClient({
            conversationsInvite: jest.fn().mockRejectedValue(archivedError),
          }) as never,
          context: { teamId: 'T1' },
          respond: jest.fn().mockResolvedValue(undefined),
          logger: { warn: jest.fn() },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('battleforge:dismiss', () => {
    it('returns early without DB call when userId is missing', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await handlers[BATTLEFORGE_ACTIONS.DISMISS]({
        ack: jest.fn().mockResolvedValue(undefined),
        body: { user: undefined },
        client: makeClient() as never,
        context: {},
        respond: jest.fn(),
        logger: { warn: jest.fn() },
      });

      expect(slackUserUpdateMany).not.toHaveBeenCalled();
    });

    it('dismiss is idempotent — calling twice does not throw', async () => {
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      const invoke = () =>
        handlers[BATTLEFORGE_ACTIONS.DISMISS]({
          ack: jest.fn().mockResolvedValue(undefined),
          body: makeBaseBody(),
          client: makeClient() as never,
          context: { teamId: 'T1' },
          respond: jest.fn().mockResolvedValue(undefined),
          logger: { warn: jest.fn() },
        });

      await expect(invoke()).resolves.toBeUndefined();
      await expect(invoke()).resolves.toBeUndefined();
      // Both calls issue the updateMany (updateMany is idempotent at DB level)
      expect(slackUserUpdateMany).toHaveBeenCalledTimes(2);
    });

    it('swallows error and does not throw when updateMany fails', async () => {
      const prisma = buildPrisma({
        slackUserUpdateMany: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await expect(
        handlers[BATTLEFORGE_ACTIONS.DISMISS]({
          ack: jest.fn().mockResolvedValue(undefined),
          body: makeBaseBody(),
          client: makeClient() as never,
          context: { teamId: 'T1' },
          respond: jest.fn(),
          logger: { warn: jest.fn() },
        }),
      ).resolves.toBeUndefined();
    });

    it('uses updateMany so missing SlackUser row is a no-op (no throw)', async () => {
      // updateMany returns count:0 when no rows match — no error
      const slackUserUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
      const prisma = buildPrisma({ slackUserUpdateMany });
      mockedGetPrismaClient.mockReturnValue(prisma as never);

      const { app, handlers } = buildApp();
      registerBattleforgeActions(app);

      await expect(
        handlers[BATTLEFORGE_ACTIONS.DISMISS]({
          ack: jest.fn().mockResolvedValue(undefined),
          body: makeBaseBody({ user: { id: 'U_GHOST', team_id: 'T1' } }),
          client: makeClient() as never,
          context: { teamId: 'T1' },
          respond: jest.fn().mockResolvedValue(undefined),
          logger: { warn: jest.fn() },
        }),
      ).resolves.toBeUndefined();

      expect(slackUserUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamId: 'T1', userId: 'U_GHOST' },
          data: { battleforgePromptDeclined: true },
        }),
      );
    });
  });
});
