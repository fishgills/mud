import { registerHomeActions } from './homeActions';
import { COMMANDS, HOME_ACTIONS } from '../commands';
import { dispatchCommandViaDM } from './commandDispatch';
import { dmClient, getLeaderboard } from '../dm-client';

jest.mock('./commandDispatch', () => ({
  dispatchCommandViaDM: jest.fn(),
}));

jest.mock('../dm-client', () => ({
  dmClient: {
    getPlayer: jest.fn(),
  },
  getLeaderboard: jest.fn(),
}));

type ActionHandler = (args: {
  ack: jest.Mock;
  body: {
    user?: { id?: string };
    team?: { id?: string };
    trigger_id?: string;
  };
  client: {
    views: { open: jest.Mock };
    conversations: { open: jest.Mock };
    chat: { postMessage: jest.Mock };
  };
  context?: { teamId?: string };
  respond?: jest.Mock;
}) => Promise<void>;

describe('registerHomeActions', () => {
  const mockedDispatch = dispatchCommandViaDM as jest.MockedFunction<
    typeof dispatchCommandViaDM
  >;
  const mockedDmClient = dmClient as unknown as { getPlayer: jest.Mock };
  const mockedGetLeaderboard = getLeaderboard as jest.MockedFunction<
    typeof getLeaderboard
  >;

  let handlers: Record<string, ActionHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    const app = {
      action: jest.fn((actionId: string, handler: ActionHandler) => {
        handlers[actionId] = handler;
      }),
    };
    registerHomeActions(app as never);
  });

  const makeClient = () => ({
    views: { open: jest.fn().mockResolvedValue(undefined) },
    conversations: {
      open: jest.fn().mockResolvedValue({ channel: { id: 'D1' } }),
    },
    chat: { postMessage: jest.fn().mockResolvedValue(undefined) },
  });

  it('dispatches resume command through DM', async () => {
    const client = makeClient();
    await handlers[HOME_ACTIONS.RESUME]({
      ack: jest.fn().mockResolvedValue(undefined),
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
    });

    expect(mockedDispatch).toHaveBeenCalledWith(
      client,
      'U1',
      COMMANDS.RUN,
      'T1',
    );
  });

  it('opens stats modal when player lookup succeeds', async () => {
    const client = makeClient();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { id: 1, name: 'Hero', level: 4, hp: 8, maxHp: 12, skillPoints: 0 },
    });

    await handlers[HOME_ACTIONS.VIEW_STATS]({
      ack: jest.fn().mockResolvedValue(undefined),
      body: { user: { id: 'U1' }, team: { id: 'T1' }, trigger_id: 'TR1' },
      client,
    });

    expect(client.views.open).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_id: 'TR1',
      }),
    );
  });

  it('opens leaderboard modal with real newlines and explicit level format', async () => {
    const client = makeClient();
    mockedGetLeaderboard
      .mockResolvedValueOnce({
        success: true,
        data: [{ name: 'Hero', level: 10 }],
      } as never)
      .mockResolvedValueOnce({
        success: true,
        data: [{ name: 'Legend', level: 12 }],
      } as never);

    await handlers[HOME_ACTIONS.VIEW_LEADERBOARD]({
      ack: jest.fn().mockResolvedValue(undefined),
      body: { user: { id: 'U1' }, team: { id: 'T1' }, trigger_id: 'TR2' },
      client,
    });

    expect(client.views.open).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_id: 'TR2',
      }),
    );

    const modalView = client.views.open.mock.calls[0][0].view;
    expect(modalView).toBeDefined();
    expect(modalView.blocks[2]).toMatchObject({ type: 'section' });

    const workspaceField = (
      modalView.blocks[2] as { fields: Array<{ text: string }> }
    ).fields[0].text;
    const globalField = (
      modalView.blocks[2] as { fields: Array<{ text: string }> }
    ).fields[1].text;

    expect(workspaceField).toContain('*This workspace*\n*1.* Hero - Level 10');
    expect(workspaceField).not.toContain('\\n');
    expect(globalField).toContain(
      '*Across all workspaces*\n*1.* Legend - Level 12',
    );
    expect(globalField).not.toContain('\\n');
  });

  it('responds ephemerally when leaderboard loading fails and respond is available', async () => {
    const client = makeClient();
    const respond = jest.fn().mockResolvedValue(undefined);
    mockedGetLeaderboard.mockRejectedValueOnce(new Error('boom'));

    await handlers[HOME_ACTIONS.VIEW_LEADERBOARD]({
      ack: jest.fn().mockResolvedValue(undefined),
      body: { user: { id: 'U1' }, team: { id: 'T1' }, trigger_id: 'TR2' },
      client,
      respond,
    });

    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ response_type: 'ephemeral' }),
    );
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it('falls back to DM when leaderboard loading fails and respond is absent', async () => {
    const client = makeClient();
    mockedGetLeaderboard.mockRejectedValueOnce(new Error('boom'));

    await handlers[HOME_ACTIONS.VIEW_LEADERBOARD]({
      ack: jest.fn().mockResolvedValue(undefined),
      body: { user: { id: 'U1' }, team: { id: 'T1' }, trigger_id: 'TR2' },
      client,
    });

    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U1' });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D1',
      }),
    );
  });
});
