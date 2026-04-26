import { registerBattleforgeEvents } from './battleforgeEvents';
import { getPrismaClient } from '@mud/database';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

type EventHandler = (args: { event: Record<string, unknown> }) => Promise<void>;

describe('registerBattleforgeEvents', () => {
  let prismaMock: {
    workspace: { findUnique: jest.Mock };
    slackUser: { updateMany: jest.Mock };
  };
  let eventHandlers: Map<string, EventHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = {
      workspace: { findUnique: jest.fn() },
      slackUser: { updateMany: jest.fn().mockResolvedValue(undefined) },
    };
    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);

    eventHandlers = new Map();
    const app = {
      event: jest.fn((eventType: string, handler: EventHandler) => {
        eventHandlers.set(eventType, handler);
      }),
    };

    registerBattleforgeEvents(app as never);
  });

  describe('member_joined_channel', () => {
    it('registers the member_joined_channel handler', () => {
      expect(eventHandlers.has('member_joined_channel')).toBe(true);
    });

    it('sets inBattleforgeChannel = true when user joins the configured battleforge channel', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: 'C_FORGE',
      });

      const handler = eventHandlers.get('member_joined_channel')!;
      await handler({
        event: {
          team: 'T1',
          channel: 'C_FORGE',
          user: 'U1',
        },
      });

      expect(prismaMock.slackUser.updateMany).toHaveBeenCalledWith({
        where: { teamId: 'T1', userId: 'U1' },
        data: { inBattleforgeChannel: true },
      });
    });

    it('does nothing when the joined channel is not the battleforge channel', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: 'C_FORGE',
      });

      const handler = eventHandlers.get('member_joined_channel')!;
      await handler({
        event: {
          team: 'T1',
          channel: 'C_GENERAL',
          user: 'U1',
        },
      });

      expect(prismaMock.slackUser.updateMany).not.toHaveBeenCalled();
    });

    it('does nothing when teamId is absent from the event', async () => {
      const handler = eventHandlers.get('member_joined_channel')!;
      await handler({
        event: {
          channel: 'C_FORGE',
          user: 'U1',
          // no team field
        },
      });

      expect(prismaMock.workspace.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.slackUser.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('member_left_channel', () => {
    it('registers the member_left_channel handler', () => {
      expect(eventHandlers.has('member_left_channel')).toBe(true);
    });

    it('sets inBattleforgeChannel = false when user leaves the configured battleforge channel', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: 'C_FORGE',
      });

      const handler = eventHandlers.get('member_left_channel')!;
      await handler({
        event: {
          team: 'T1',
          channel: 'C_FORGE',
          user: 'U1',
        },
      });

      expect(prismaMock.slackUser.updateMany).toHaveBeenCalledWith({
        where: { teamId: 'T1', userId: 'U1' },
        data: { inBattleforgeChannel: false },
      });
    });

    it('does nothing when the left channel is not the battleforge channel', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: 'C_FORGE',
      });

      const handler = eventHandlers.get('member_left_channel')!;
      await handler({
        event: {
          team: 'T1',
          channel: 'C_RANDOM',
          user: 'U2',
        },
      });

      expect(prismaMock.slackUser.updateMany).not.toHaveBeenCalled();
    });
  });
});
