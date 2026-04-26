import { maybeShowBattleforgePrompt } from './battleforgeNudge';
import { getPrismaClient } from '@mud/database';

jest.mock('@mud/database', () => ({
  getPrismaClient: jest.fn(),
}));

describe('maybeShowBattleforgePrompt', () => {
  let prismaMock: {
    slackUser: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    workspace: {
      findUnique: jest.Mock;
    };
  };
  let client: {
    conversations: { open: jest.Mock };
    chat: { postEphemeral: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = {
      slackUser: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue(undefined),
      },
      workspace: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ battleforgeChannelId: 'C_BATTLEFORGE' }),
      },
    };
    (getPrismaClient as jest.Mock).mockReturnValue(prismaMock);

    client = {
      conversations: {
        open: jest.fn().mockResolvedValue({ channel: { id: 'D_CHANNEL' } }),
      },
      chat: {
        postEphemeral: jest.fn().mockResolvedValue(undefined),
      },
    };
  });

  it('sends an ephemeral prompt with two action buttons when user has never been prompted', async () => {
    prismaMock.slackUser.findUnique.mockResolvedValue({
      inBattleforgeChannel: false,
      battleforgePromptDeclined: false,
      lastBattleforgePromptAt: null,
    });

    await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U1' });
    expect(client.chat.postEphemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D_CHANNEL',
        user: 'U1',
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'actions' }),
        ]),
      }),
    );

    // Confirm both action buttons are present
    const call = client.chat.postEphemeral.mock.calls[0][0] as {
      blocks: Array<{ elements?: Array<{ action_id?: string }> }>;
    };
    const actionsBlock = call.blocks.find((b) => b.elements);
    const actionIds = (actionsBlock?.elements ?? []).map((e) => e.action_id);
    expect(actionIds).toContain('battleforge:join');
    expect(actionIds).toContain('battleforge:dismiss');
  });

  it('updates lastBattleforgePromptAt after sending the ephemeral', async () => {
    prismaMock.slackUser.findUnique.mockResolvedValue({
      inBattleforgeChannel: false,
      battleforgePromptDeclined: false,
      lastBattleforgePromptAt: null,
    });

    await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

    expect(prismaMock.slackUser.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'T1', userId: 'U1' },
      data: { lastBattleforgePromptAt: expect.any(Date) },
    });
    // Update should happen after the ephemeral is posted (timestamp only bumped on success)
    const updateOrder =
      prismaMock.slackUser.updateMany.mock.invocationCallOrder[0];
    const ephemeralOrder =
      client.chat.postEphemeral.mock.invocationCallOrder[0];
    expect(updateOrder).toBeGreaterThan(ephemeralOrder!);
  });

  it('does nothing when the user is already in the channel', async () => {
    prismaMock.slackUser.findUnique.mockResolvedValue({
      inBattleforgeChannel: true,
      battleforgePromptDeclined: false,
      lastBattleforgePromptAt: null,
    });

    await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

    expect(client.chat.postEphemeral).not.toHaveBeenCalled();
  });

  it('does nothing when the user has declined the prompt', async () => {
    prismaMock.slackUser.findUnique.mockResolvedValue({
      inBattleforgeChannel: false,
      battleforgePromptDeclined: true,
      lastBattleforgePromptAt: null,
    });

    await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

    expect(client.chat.postEphemeral).not.toHaveBeenCalled();
  });

  it('does nothing when the user was prompted less than 7 days ago', async () => {
    const recentPrompt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    prismaMock.slackUser.findUnique.mockResolvedValue({
      inBattleforgeChannel: false,
      battleforgePromptDeclined: false,
      lastBattleforgePromptAt: recentPrompt,
    });

    await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

    expect(client.chat.postEphemeral).not.toHaveBeenCalled();
  });

  it('sends the prompt when last prompted exactly over 7 days ago', async () => {
    const oldPrompt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
    prismaMock.slackUser.findUnique.mockResolvedValue({
      inBattleforgeChannel: false,
      battleforgePromptDeclined: false,
      lastBattleforgePromptAt: oldPrompt,
    });

    await maybeShowBattleforgePrompt(client as never, 'T1', 'U1');

    expect(client.chat.postEphemeral).toHaveBeenCalled();
  });

  it('does nothing when the slack user record does not exist', async () => {
    prismaMock.slackUser.findUnique.mockResolvedValue(null);

    await maybeShowBattleforgePrompt(client as never, 'T1', 'U_UNKNOWN');

    expect(client.chat.postEphemeral).not.toHaveBeenCalled();
  });
});
