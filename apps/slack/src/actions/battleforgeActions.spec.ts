import {
  registerBattleforgeActions,
  BATTLEFORGE_ACTIONS,
} from './battleforgeActions';
import { getPrismaClient } from '@mud/database';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

// getActionContext is a thin wrapper around body/context fields — no need to mock
// the whole module; let it run with real inputs.

type SlackHandler = (args: {
  ack: jest.Mock;
  body: Record<string, unknown>;
  client?: { conversations: { invite: jest.Mock } };
  context: { teamId?: string };
  respond: jest.Mock;
  logger?: { warn: jest.Mock };
}) => Promise<void>;

describe('registerBattleforgeActions', () => {
  let prismaMock: {
    workspace: { findUnique: jest.Mock };
    slackUser: { updateMany: jest.Mock };
  };
  let actionHandlers: Map<string, SlackHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = {
      workspace: { findUnique: jest.fn() },
      slackUser: { updateMany: jest.fn().mockResolvedValue(undefined) },
    };
    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);

    actionHandlers = new Map();
    const app = {
      action: jest.fn((actionId: string, handler: SlackHandler) => {
        actionHandlers.set(actionId, handler);
      }),
    };

    registerBattleforgeActions(app as never);
  });

  describe('battleforge:join', () => {
    const makeJoinArgs = (
      overrides?: Partial<Parameters<SlackHandler>[0]>,
    ) => ({
      ack: jest.fn().mockResolvedValue(undefined),
      body: {
        user: { id: 'U1' },
        team: { id: 'T1' },
      },
      client: {
        conversations: { invite: jest.fn().mockResolvedValue(undefined) },
      },
      context: { teamId: 'T1' },
      respond: jest.fn().mockResolvedValue(undefined),
      logger: { warn: jest.fn() },
      ...overrides,
    });

    it('registers the join action handler', () => {
      expect(actionHandlers.has(BATTLEFORGE_ACTIONS.JOIN)).toBe(true);
    });

    it('invites user to battleforge channel and updates inBattleforgeChannel = true', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: 'C_BATTLEFORGE',
      });

      const args = makeJoinArgs();
      await actionHandlers.get(BATTLEFORGE_ACTIONS.JOIN)!(args);

      expect(args.ack).toHaveBeenCalled();
      expect(args.client!.conversations.invite).toHaveBeenCalledWith({
        channel: 'C_BATTLEFORGE',
        users: 'U1',
      });
      expect(prismaMock.slackUser.updateMany).toHaveBeenCalledWith({
        where: { teamId: 'T1', userId: 'U1' },
        data: { inBattleforgeChannel: true },
      });
    });

    it('responds with confirmation after joining', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: 'C_BATTLEFORGE',
      });

      const args = makeJoinArgs();
      await actionHandlers.get(BATTLEFORGE_ACTIONS.JOIN)!(args);

      expect(args.respond).toHaveBeenCalledWith(
        expect.objectContaining({
          replace_original: true,
          text: expect.stringContaining('#battleforge'),
        }),
      );
    });

    it('returns early (without invite) when workspace has no battleforge channel', async () => {
      prismaMock.workspace.findUnique.mockResolvedValue({
        battleforgeChannelId: null,
      });

      const args = makeJoinArgs();
      await actionHandlers.get(BATTLEFORGE_ACTIONS.JOIN)!(args);

      expect(args.client!.conversations.invite).not.toHaveBeenCalled();
      expect(prismaMock.slackUser.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('battleforge:dismiss', () => {
    const makeDismissArgs = (
      overrides?: Partial<Parameters<SlackHandler>[0]>,
    ) => ({
      ack: jest.fn().mockResolvedValue(undefined),
      body: {
        user: { id: 'U2' },
        team: { id: 'T2' },
      },
      context: { teamId: 'T2' },
      respond: jest.fn().mockResolvedValue(undefined),
      logger: { warn: jest.fn() },
      ...overrides,
    });

    it('registers the dismiss action handler', () => {
      expect(actionHandlers.has(BATTLEFORGE_ACTIONS.DISMISS)).toBe(true);
    });

    it('sets battleforgePromptDeclined = true', async () => {
      const args = makeDismissArgs();
      await actionHandlers.get(BATTLEFORGE_ACTIONS.DISMISS)!(args);

      expect(args.ack).toHaveBeenCalled();
      expect(prismaMock.slackUser.updateMany).toHaveBeenCalledWith({
        where: { teamId: 'T2', userId: 'U2' },
        data: { battleforgePromptDeclined: true },
      });
    });

    it('responds with a dismissal confirmation message', async () => {
      const args = makeDismissArgs();
      await actionHandlers.get(BATTLEFORGE_ACTIONS.DISMISS)!(args);

      expect(args.respond).toHaveBeenCalledWith(
        expect.objectContaining({
          replace_original: true,
          text: expect.stringContaining('no problem'),
        }),
      );
    });
  });
});
