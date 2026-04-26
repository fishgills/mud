/**
 * Adversarial tests for TrackingInstallationStore.bootstrapBattleforgeChannel.
 *
 * BUG DOCUMENTED (flagged for reviewer):
 *   conversations.join is called BEFORE setBattleforgeChannelId (line 114 vs 117).
 *   If join fails, the channelId is never persisted. On the next install, the
 *   code falls through to create again (or list), but the bot is already in the
 *   channel. This means we silently lose track of the channel.
 *   See test: "[BUG] persists channelId even when conversations.join fails"
 */

import { TrackingInstallationStore } from './installation-store';
import {
  upsertWorkspaceInstall,
  setBattleforgeChannelId,
  getPrismaClient,
} from '@mud/database';
import { WebClient } from '@slack/web-api';

jest.mock('@mud/database', () => ({
  upsertWorkspaceInstall: jest.fn(),
  setBattleforgeChannelId: jest.fn(),
  getPrismaClient: jest.fn(),
}));

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn(),
}));

const mockedUpsertWorkspaceInstall =
  upsertWorkspaceInstall as jest.MockedFunction<typeof upsertWorkspaceInstall>;
const mockedSetBattleforgeChannelId =
  setBattleforgeChannelId as jest.MockedFunction<
    typeof setBattleforgeChannelId
  >;
const mockedGetPrismaClient = getPrismaClient as jest.MockedFunction<
  typeof getPrismaClient
>;
const MockedWebClient = WebClient as jest.MockedClass<typeof WebClient>;

const buildPrisma = (
  overrides: {
    workspaceFindUnique?: jest.Mock;
    slackUserUpdateMany?: jest.Mock;
  } = {},
) => ({
  workspace: {
    findUnique:
      overrides.workspaceFindUnique ??
      jest.fn().mockResolvedValue({ battleforgeChannelId: null }),
  },
  slackUser: {
    updateMany:
      overrides.slackUserUpdateMany ??
      jest.fn().mockResolvedValue({ count: 0 }),
  },
});

const buildWebClient = (
  overrides: {
    conversationsCreate?: jest.Mock;
    conversationsList?: jest.Mock;
    conversationsJoin?: jest.Mock;
    conversationsInfo?: jest.Mock;
    conversationsMembers?: jest.Mock;
    chatPostMessage?: jest.Mock;
  } = {},
) => ({
  conversations: {
    create:
      overrides.conversationsCreate ??
      jest.fn().mockResolvedValue({ channel: { id: 'C_NEW' } }),
    list:
      overrides.conversationsList ??
      jest.fn().mockResolvedValue({
        channels: [{ name: 'battleforge', id: 'C_EXISTING' }],
      }),
    join:
      overrides.conversationsJoin ?? jest.fn().mockResolvedValue({ ok: true }),
    info:
      overrides.conversationsInfo ??
      jest.fn().mockResolvedValue({ channel: { is_archived: false } }),
    members:
      overrides.conversationsMembers ??
      jest.fn().mockResolvedValue({ members: [] }),
  },
  chat: {
    postMessage:
      overrides.chatPostMessage ?? jest.fn().mockResolvedValue({ ok: true }),
  },
});

const makeInstallation = (
  overrides: {
    teamId?: string;
    botToken?: string;
  } = {},
) => ({
  team: { id: overrides.teamId ?? 'T1', name: 'Test Team' },
  bot: {
    token: overrides.botToken ?? 'xoxb-test-token',
    userId: 'UBOT',
    scopes: ['channels:manage'],
    id: 'B1',
  },
  user: { token: undefined, scopes: undefined, id: 'U1' },
  appId: 'A1',
  isEnterpriseInstall: false,
});

const buildStore = () => {
  const baseStore = {
    storeInstallation: jest.fn().mockResolvedValue(undefined),
    fetchInstallation: jest.fn().mockResolvedValue({}),
    deleteInstallation: jest.fn().mockResolvedValue(undefined),
  };
  return new TrackingInstallationStore(baseStore as never);
};

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('TrackingInstallationStore — adversarial', () => {
  describe('storeInstallation guards', () => {
    it('does not call upsertWorkspaceInstall when teamId is absent', async () => {
      const store = buildStore();
      const installation = makeInstallation();
      delete (installation as { team?: unknown }).team;

      await store.storeInstallation(installation as never);

      expect(mockedUpsertWorkspaceInstall).not.toHaveBeenCalled();
    });

    it('skips bootstrap when bot token is missing', async () => {
      const prisma = buildPrisma();
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      mockedUpsertWorkspaceInstall.mockResolvedValue(undefined as never);
      mockedSetBattleforgeChannelId.mockResolvedValue(undefined as never);

      const mockClient = buildWebClient();
      MockedWebClient.mockImplementation(() => mockClient as never);

      const store = buildStore();
      const installation = makeInstallation({ botToken: undefined });
      delete (installation.bot as { token?: string }).token;

      await store.storeInstallation(installation as never);
      await flushPromises();

      expect(MockedWebClient).not.toHaveBeenCalled();
      expect(mockedSetBattleforgeChannelId).not.toHaveBeenCalled();
    });
  });

  describe('bootstrapBattleforgeChannel — conversations.create failures', () => {
    it('falls back to conversations.list on name_taken error', async () => {
      const prisma = buildPrisma({
        workspaceFindUnique: jest
          .fn()
          .mockResolvedValue({ battleforgeChannelId: null }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      mockedUpsertWorkspaceInstall.mockResolvedValue(undefined as never);
      mockedSetBattleforgeChannelId.mockResolvedValue(undefined as never);

      const nameTakenError = new Error('name_taken');
      (nameTakenError as { data?: { error?: string } }).data = {
        error: 'name_taken',
      };

      const conversationsList = jest.fn().mockResolvedValue({
        channels: [{ name: 'battleforge', id: 'C_TAKEN' }],
      });

      const mockClient = buildWebClient({
        conversationsCreate: jest.fn().mockRejectedValue(nameTakenError),
        conversationsList,
      });
      MockedWebClient.mockImplementation(() => mockClient as never);

      const store = buildStore();
      await store.storeInstallation(makeInstallation() as never);
      await flushPromises();

      expect(conversationsList).toHaveBeenCalled();
      expect(mockedSetBattleforgeChannelId).toHaveBeenCalledWith(
        'T1',
        'C_TAKEN',
      );
    });

    it('swallows non-name_taken error without crashing the install', async () => {
      const prisma = buildPrisma({
        workspaceFindUnique: jest
          .fn()
          .mockResolvedValue({ battleforgeChannelId: null }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      mockedUpsertWorkspaceInstall.mockResolvedValue(undefined as never);
      mockedSetBattleforgeChannelId.mockResolvedValue(undefined as never);

      const missingScopeError = new Error('missing_scope');
      (missingScopeError as { data?: { error?: string } }).data = {
        error: 'missing_scope',
      };

      const mockClient = buildWebClient({
        conversationsCreate: jest.fn().mockRejectedValue(missingScopeError),
      });
      MockedWebClient.mockImplementation(() => mockClient as never);

      const store = buildStore();
      // storeInstallation itself must not throw
      await expect(
        store.storeInstallation(makeInstallation() as never),
      ).resolves.toBeUndefined();
      await flushPromises();

      expect(mockedSetBattleforgeChannelId).not.toHaveBeenCalled();
    });
  });

  describe('bootstrapBattleforgeChannel — conversations.join failure', () => {
    /**
     * BUG: conversations.join is called BEFORE setBattleforgeChannelId.
     * If join fails, the outer catch swallows it and setBattleforgeChannelId
     * is never called. The channel is created but never tracked.
     *
     * This test asserts the CORRECT intended behavior (channelId persisted even
     * when join fails) and is EXPECTED TO FAIL on the current implementation.
     */
    it('[BUG] persists channelId even when conversations.join fails', async () => {
      const prisma = buildPrisma({
        workspaceFindUnique: jest
          .fn()
          .mockResolvedValue({ battleforgeChannelId: null }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      mockedUpsertWorkspaceInstall.mockResolvedValue(undefined as never);
      mockedSetBattleforgeChannelId.mockResolvedValue(undefined as never);

      const mockClient = buildWebClient({
        conversationsJoin: jest
          .fn()
          .mockRejectedValue(
            new Error('method_not_supported_for_channel_type'),
          ),
      });
      MockedWebClient.mockImplementation(() => mockClient as never);

      const store = buildStore();
      await store.storeInstallation(makeInstallation() as never);
      await flushPromises();

      // Channel was created successfully — ID should have been persisted
      // BEFORE join was attempted. Currently the outer catch swallows everything.
      expect(mockedSetBattleforgeChannelId).toHaveBeenCalledWith('T1', 'C_NEW');
    });
  });

  describe('bootstrapBattleforgeChannel — idempotency', () => {
    it('is a no-op when battleforgeChannelId is already set and channel exists', async () => {
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: 'C_EXISTING',
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      mockedUpsertWorkspaceInstall.mockResolvedValue(undefined as never);
      mockedSetBattleforgeChannelId.mockResolvedValue(undefined as never);

      const mockClient = buildWebClient({
        conversationsInfo: jest
          .fn()
          .mockResolvedValue({ channel: { is_archived: false } }),
      });
      MockedWebClient.mockImplementation(() => mockClient as never);

      const store = buildStore();
      await store.storeInstallation(makeInstallation() as never);
      await flushPromises();

      expect(mockClient.conversations.create).not.toHaveBeenCalled();
      expect(mockedSetBattleforgeChannelId).not.toHaveBeenCalled();
    });

    it('re-creates channel when existing channel is archived', async () => {
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: 'C_ARCHIVED',
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      mockedUpsertWorkspaceInstall.mockResolvedValue(undefined as never);
      mockedSetBattleforgeChannelId.mockResolvedValue(undefined as never);

      const mockClient = buildWebClient({
        conversationsInfo: jest
          .fn()
          .mockResolvedValue({ channel: { is_archived: true } }),
        conversationsCreate: jest
          .fn()
          .mockResolvedValue({ channel: { id: 'C_NEW' } }),
      });
      MockedWebClient.mockImplementation(() => mockClient as never);

      const store = buildStore();
      await store.storeInstallation(makeInstallation() as never);
      await flushPromises();

      expect(mockClient.conversations.create).toHaveBeenCalled();
    });

    it('falls through to create when conversations.info throws (channel inaccessible)', async () => {
      const prisma = buildPrisma({
        workspaceFindUnique: jest.fn().mockResolvedValue({
          battleforgeChannelId: 'C_INACCESSIBLE',
        }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      mockedUpsertWorkspaceInstall.mockResolvedValue(undefined as never);
      mockedSetBattleforgeChannelId.mockResolvedValue(undefined as never);

      const mockClient = buildWebClient({
        conversationsInfo: jest
          .fn()
          .mockRejectedValue(new Error('channel_not_found')),
        conversationsCreate: jest
          .fn()
          .mockResolvedValue({ channel: { id: 'C_NEW' } }),
      });
      MockedWebClient.mockImplementation(() => mockClient as never);

      const store = buildStore();
      await store.storeInstallation(makeInstallation() as never);
      await flushPromises();

      expect(mockClient.conversations.create).toHaveBeenCalled();
    });
  });

  describe('bootstrapBattleforgeChannel — name_taken: list returns no match', () => {
    it('aborts without persisting when list does not contain battleforge channel', async () => {
      const prisma = buildPrisma({
        workspaceFindUnique: jest
          .fn()
          .mockResolvedValue({ battleforgeChannelId: null }),
      });
      mockedGetPrismaClient.mockReturnValue(prisma as never);
      mockedUpsertWorkspaceInstall.mockResolvedValue(undefined as never);
      mockedSetBattleforgeChannelId.mockResolvedValue(undefined as never);

      const nameTakenError = new Error('name_taken');
      (nameTakenError as { data?: { error?: string } }).data = {
        error: 'name_taken',
      };

      const mockClient = buildWebClient({
        conversationsCreate: jest.fn().mockRejectedValue(nameTakenError),
        conversationsList: jest.fn().mockResolvedValue({
          channels: [{ name: 'general', id: 'C_GENERAL' }],
        }),
      });
      MockedWebClient.mockImplementation(() => mockClient as never);

      const store = buildStore();
      await store.storeInstallation(makeInstallation() as never);
      await flushPromises();

      expect(mockedSetBattleforgeChannelId).not.toHaveBeenCalled();
    });
  });

  describe('deleteInstallation', () => {
    it('delegates to baseStore.deleteInstallation when it exists', async () => {
      const baseStore = {
        storeInstallation: jest.fn().mockResolvedValue(undefined),
        fetchInstallation: jest.fn().mockResolvedValue({}),
        deleteInstallation: jest.fn().mockResolvedValue(undefined),
      };
      const store = new TrackingInstallationStore(baseStore as never);
      const query = { teamId: 'T1', isEnterpriseInstall: false } as never;

      await store.deleteInstallation(query);

      expect(baseStore.deleteInstallation).toHaveBeenCalledWith(
        query,
        undefined,
      );
    });

    it('does not throw when baseStore has no deleteInstallation method', async () => {
      const baseStore = {
        storeInstallation: jest.fn().mockResolvedValue(undefined),
        fetchInstallation: jest.fn().mockResolvedValue({}),
      };
      const store = new TrackingInstallationStore(baseStore as never);
      const query = { teamId: 'T1', isEnterpriseInstall: false } as never;

      await expect(store.deleteInstallation(query)).resolves.toBeUndefined();
    });
  });
});
