import { registerRunActions } from './runActions';
import { RUN_ACTIONS } from '../commands';
import { dmClient } from '../dm-client';

jest.mock('../dm-client', () => ({
  dmClient: {
    continueRun: jest.fn(),
    finishRun: jest.fn(),
  },
}));

type ActionHandler = (args: {
  ack: jest.Mock;
  body: {
    user?: { id?: string };
    team?: { id?: string };
    actions?: Array<{ value?: string }>;
    container?: { channel_id?: string; message_ts?: string };
    message?: { text?: string; blocks?: Array<{ type: string }> };
  };
  client: {
    chat: {
      update: jest.Mock;
      postMessage: jest.Mock;
    };
    conversations: {
      open: jest.Mock;
    };
  };
  context?: { teamId?: string };
}) => Promise<void>;

describe('registerRunActions', () => {
  const mockedDmClient = dmClient as unknown as {
    continueRun: jest.Mock;
    finishRun: jest.Mock;
  };

  let handlers: Record<string, ActionHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    const app = {
      action: jest.fn((actionId: string, handler: ActionHandler) => {
        handlers[actionId] = handler;
      }),
    };
    registerRunActions(app as never);
  });

  const makeClient = () => ({
    chat: {
      update: jest.fn().mockResolvedValue(undefined),
      postMessage: jest.fn().mockResolvedValue(undefined),
    },
    conversations: {
      open: jest.fn().mockResolvedValue({ channel: { id: 'D1' } }),
    },
  });

  it('continues a run and removes action buttons from the source message', async () => {
    mockedDmClient.continueRun.mockResolvedValueOnce({ success: true });
    const client = makeClient();
    const ack = jest.fn().mockResolvedValue(undefined);

    await handlers[RUN_ACTIONS.CONTINUE]({
      ack,
      body: {
        user: { id: 'U1' },
        team: { id: 'T1' },
        actions: [{ value: '42' }],
        container: { channel_id: 'C1', message_ts: '123.456' },
        message: {
          text: 'Raid update',
          blocks: [{ type: 'section' }, { type: 'actions' }],
        },
      },
      client,
    });

    expect(ack).toHaveBeenCalled();
    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C1',
        ts: '123.456',
      }),
    );
    expect(mockedDmClient.continueRun).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
      runId: 42,
    });
  });

  it('posts an error message when continue fails', async () => {
    mockedDmClient.continueRun.mockResolvedValueOnce({
      success: false,
      message: 'Could not continue',
    });
    const client = makeClient();

    await handlers[RUN_ACTIONS.CONTINUE]({
      ack: jest.fn().mockResolvedValue(undefined),
      body: {
        user: { id: 'U1' },
        team: { id: 'T1' },
        container: { channel_id: 'C1' },
      },
      client,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C1',
      text: 'Could not continue',
    });
  });

  it('finishes a run and confirms rewards', async () => {
    mockedDmClient.finishRun.mockResolvedValueOnce({ success: true });
    const client = makeClient();

    await handlers[RUN_ACTIONS.FINISH]({
      ack: jest.fn().mockResolvedValue(undefined),
      body: {
        user: { id: 'U1' },
        team: { id: 'T1' },
        actions: [{ value: '7' }],
        container: { channel_id: 'C1' },
      },
      client,
    });

    expect(mockedDmClient.finishRun).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
      runId: 7,
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith({
      channel: 'C1',
      text: 'Raid cashed out. Rewards are on the way.',
    });
  });

  it('returns early when required action context is missing', async () => {
    const client = makeClient();
    await handlers[RUN_ACTIONS.FINISH]({
      ack: jest.fn().mockResolvedValue(undefined),
      body: {
        user: { id: 'U1' },
      },
      client,
    });
    expect(mockedDmClient.finishRun).not.toHaveBeenCalled();
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });
});
