import { TrackingInstallationStore } from './installation-store';
import {
  upsertWorkspaceInstall,
  setBattleforgeChannelId,
  getPrismaClient,
} from '@mud/database';
import { WebClient } from '@slack/web-api';

jest.mock('@mud/database', () => ({
  upsertWorkspaceInstall: jest.fn().mockResolvedValue(undefined),
  setBattleforgeChannelId: jest.fn().mockResolvedValue(undefined),
  getPrismaClient: jest.fn(),
}));

jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn(),
}));

describe('TrackingInstallationStore', () => {
  let baseStore: {
    storeInstallation: jest.Mock;
    fetchInstallation: jest.Mock;
    deleteInstallation: jest.Mock;
  };
  let prismaMock: {
    workspace: { findUnique: jest.Mock };
    slackUser: { updateMany: jest.Mock };
  };
  let webClientMock: {
    conversations: {
      info: jest.Mock;
      create: jest.Mock;
      join: jest.Mock;
      list: jest.Mock;
      members: jest.Mock;
    };
    chat: { postMessage: jest.Mock };
  };
  let store: TrackingInstallationStore;

  beforeEach(() => {
    jest.clearAllMocks();

    baseStore = {
      storeInstallation: jest.fn().mockResolvedValue(undefined),
      fetchInstallation: jest.fn().mockResolvedValue({}),
      deleteInstallation: jest.fn().mockResolvedValue(undefined),
    };

    prismaMock = {
      workspace: { findUnique: jest.fn() },
      slackUser: { updateMany: jest.fn().mockResolvedValue(undefined) },
    };
    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);

    webClientMock = {
      conversations: {
        info: jest.fn(),
        create: jest.fn().mockResolvedValue({ channel: { id: 'C_NEW' } }),
        join: jest.fn().mockResolvedValue(undefined),
        list: jest.fn(),
        members: jest.fn().mockResolvedValue({ members: ['U_BOT'] }),
      },
      chat: { postMessage: jest.fn().mockResolvedValue(undefined) },
    };
    (WebClient as jest.Mock).mockImplementation(() => webClientMock);

    store = new TrackingInstallationStore(baseStore as never);
  });

  describe('storeInstallation', () => {
    it('delegates to the base store', async () => {
      const installation = {
        team: { id: 'T1' },
        bot: { token: 'xoxb-token' },
      };

      await store.storeInstallation(installation as never);

      expect(baseStore.storeInstallation).toHaveBeenCalledWith(
        installation,
        undefined,
      );
    });

    it('upserts the workspace on install', async () => {
      const installation = {
        team: { id: 'T1' },
        bot: { token: 'xoxb-token' },
      };

      await store.storeInstallation(installation as never);

      expect(upsertWorkspaceInstall).toHaveBeenCalledWith('T1');
    });
  });

  describe('bootstrapBattleforgeChannel (via storeInstallation)', () => {
    const makeInstallation = () => ({
      team: { id: 'T_NEW' },
      bot: { token: 'xoxb-fresh' },
    });

    it('creates #battleforge, joins it, persists channel id, seeds members, and posts welcome on a fresh install', async () => {
      // No existing channel
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: null,
      });
      webClientMock.conversations.create.mockResolvedValue({
        channel: { id: 'C_FORGE' },
      });
      webClientMock.conversations.members.mockResolvedValue({
        members: ['U1', 'U2'],
      });

      // storeInstallation fires bootstrap as void (fire-and-forget) — let it complete
      await store.storeInstallation(makeInstallation() as never);
      // Flush all pending microtasks so the fire-and-forget void promise settles
      await new Promise(setImmediate);

      expect(webClientMock.conversations.create).toHaveBeenCalledWith({
        name: 'battleforge',
        is_private: false,
      });
      expect(webClientMock.conversations.join).toHaveBeenCalledWith({
        channel: 'C_FORGE',
      });
      expect(setBattleforgeChannelId).toHaveBeenCalledWith('T_NEW', 'C_FORGE');
      expect(prismaMock.slackUser.updateMany).toHaveBeenCalledWith({
        where: { teamId: 'T_NEW', userId: { in: ['U1', 'U2'] } },
        data: { inBattleforgeChannel: true },
      });
      expect(webClientMock.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C_FORGE',
          text: expect.stringContaining('Welcome'),
        }),
      );
    });

    it('skips creation when workspace already has an active channel', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: 'C_EXISTING',
      });
      webClientMock.conversations.info.mockResolvedValue({
        channel: { id: 'C_EXISTING', is_archived: false },
      });

      await store.storeInstallation(makeInstallation() as never);
      await new Promise(setImmediate);

      expect(webClientMock.conversations.create).not.toHaveBeenCalled();
      expect(setBattleforgeChannelId).not.toHaveBeenCalled();
    });

    it('finds existing channel by name when create returns name_taken error', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: null,
      });
      const nameTakenError = { data: { error: 'name_taken' } };
      webClientMock.conversations.create.mockRejectedValue(nameTakenError);
      webClientMock.conversations.list.mockResolvedValue({
        channels: [
          { id: 'C_TAKEN', name: 'battleforge' },
          { id: 'C_OTHER', name: 'general' },
        ],
      });
      webClientMock.conversations.members.mockResolvedValue({ members: [] });

      await store.storeInstallation(makeInstallation() as never);
      await new Promise(setImmediate);

      expect(webClientMock.conversations.join).toHaveBeenCalledWith({
        channel: 'C_TAKEN',
      });
      expect(setBattleforgeChannelId).toHaveBeenCalledWith('T_NEW', 'C_TAKEN');
    });
  });

  describe('fetchInstallation', () => {
    it('delegates to the base store', async () => {
      const query = { teamId: 'T1', isEnterpriseInstall: false };
      baseStore.fetchInstallation.mockResolvedValue({ bot: { token: 'x' } });

      const result = await store.fetchInstallation(query as never);

      expect(baseStore.fetchInstallation).toHaveBeenCalledWith(
        query,
        undefined,
      );
      expect(result).toEqual({ bot: { token: 'x' } });
    });
  });

  describe('deleteInstallation', () => {
    it('delegates to the base store when it supports delete', async () => {
      const query = { teamId: 'T1', isEnterpriseInstall: false };

      await store.deleteInstallation(query as never);

      expect(baseStore.deleteInstallation).toHaveBeenCalledWith(
        query,
        undefined,
      );
    });
  });
});
