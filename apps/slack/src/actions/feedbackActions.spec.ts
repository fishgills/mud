import { registerFeedbackActions } from './feedbackActions';
import { FEEDBACK_ACTIONS } from '../commands';
import { dmClient } from '../dm-client';

jest.mock('../dm-client', () => ({
  dmClient: {
    getPlayer: jest.fn(),
    submitFeedback: jest.fn(),
    deleteFeedback: jest.fn(),
  },
}));

type SlackHandler = (args: {
  ack: jest.Mock;
  body?: {
    user?: { id?: string };
    team?: { id?: string };
    trigger_id?: string;
  };
  view?: {
    private_metadata?: string;
    state?: {
      values?: Record<
        string,
        Record<
          string,
          {
            value?: string | null;
            selected_option?: { value?: string | null };
          }
        >
      >;
    };
  };
  client: {
    views: { open: jest.Mock };
    conversations: { open: jest.Mock };
    chat: { postMessage: jest.Mock };
  };
  context?: { teamId?: string };
  logger?: {
    debug?: jest.Mock;
    warn?: jest.Mock;
    error?: jest.Mock;
  };
}) => Promise<void>;

describe('registerFeedbackActions', () => {
  const mockedDmClient = dmClient as unknown as {
    getPlayer: jest.Mock;
    submitFeedback: jest.Mock;
  };

  let actionHandlers: Array<{ id: string | RegExp; handler: SlackHandler }>;
  let viewHandlers: Record<string, SlackHandler>;

  beforeEach(() => {
    jest.clearAllMocks();
    actionHandlers = [];
    viewHandlers = {};
    const app = {
      action: jest.fn((id: string | RegExp, handler: SlackHandler) => {
        actionHandlers.push({ id, handler });
      }),
      view: jest.fn((id: string, handler: SlackHandler) => {
        viewHandlers[id] = handler;
      }),
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    registerFeedbackActions(app as never);
  });

  it('opens the feedback modal from the Home tab button', async () => {
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { id: 42 },
    });
    const openModalHandler = actionHandlers.find(
      (entry) => entry.id === FEEDBACK_ACTIONS.OPEN_MODAL,
    )?.handler;
    expect(openModalHandler).toBeDefined();
    if (!openModalHandler) {
      throw new Error('Feedback open modal handler not registered');
    }

    const ack = jest.fn().mockResolvedValue(undefined);
    const viewsOpen = jest.fn().mockResolvedValue(undefined);
    const client = {
      views: { open: viewsOpen },
      conversations: { open: jest.fn() },
      chat: { postMessage: jest.fn() },
    };

    await openModalHandler({
      ack,
      body: {
        user: { id: 'U1' },
        team: { id: 'T1' },
        trigger_id: 'TRIGGER',
      },
      client,
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      context: { teamId: 'T1' },
    });

    expect(ack).toHaveBeenCalled();
    expect(viewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger_id: 'TRIGGER',
        view: expect.objectContaining({
          callback_id: 'feedback_modal_submit',
        }),
      }),
    );
  });

  it('submits feedback without a player id when no character exists', async () => {
    mockedDmClient.submitFeedback.mockResolvedValueOnce({
      success: true,
      ignored: true,
    });

    const viewHandler = viewHandlers.feedback_modal_submit;
    expect(viewHandler).toBeDefined();
    if (!viewHandler) {
      throw new Error('Feedback submit handler not registered');
    }

    const ack = jest.fn().mockResolvedValue(undefined);
    const client = {
      views: { open: jest.fn() },
      conversations: {
        open: jest.fn().mockResolvedValue({ channel: { id: 'D1' } }),
      },
      chat: {
        postMessage: jest.fn().mockResolvedValue(undefined),
      },
    };

    await viewHandler({
      ack,
      view: {
        private_metadata: JSON.stringify({
          teamId: 'T1',
          userId: 'U1',
        }),
        state: {
          values: {
            feedback_type_block: {
              feedback_type: {
                selected_option: { value: 'general' },
              },
            },
            feedback_content_block: {
              feedback_content: {
                value: 'The game is fun but this is just a quick note.',
              },
            },
          },
        },
      },
      client,
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    expect(ack).toHaveBeenCalled();
    expect(mockedDmClient.submitFeedback).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
      type: 'general',
      content: 'The game is fun but this is just a quick note.',
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D1',
        text: expect.stringContaining('Thanks for taking the time'),
      }),
    );
  });

  it('sends moderation rejection reason back to the user', async () => {
    mockedDmClient.submitFeedback.mockResolvedValueOnce({
      success: false,
      rejectionReason: 'not game-related',
    });

    const viewHandler = viewHandlers.feedback_modal_submit;
    expect(viewHandler).toBeDefined();
    if (!viewHandler) {
      throw new Error('Feedback submit handler not registered');
    }

    const ack = jest.fn().mockResolvedValue(undefined);
    const client = {
      views: { open: jest.fn() },
      conversations: {
        open: jest.fn().mockResolvedValue({ channel: { id: 'D1' } }),
      },
      chat: {
        postMessage: jest.fn().mockResolvedValue(undefined),
      },
    };

    await viewHandler({
      ack,
      view: {
        private_metadata: JSON.stringify({
          teamId: 'T1',
          userId: 'U1',
        }),
        state: {
          values: {
            feedback_type_block: {
              feedback_type: {
                selected_option: { value: 'general' },
              },
            },
            feedback_content_block: {
              feedback_content: {
                value: 'This message should be rejected by moderation.',
              },
            },
          },
        },
      },
      client,
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });

    expect(ack).toHaveBeenCalled();
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D1',
        text: expect.stringContaining(
          "We couldn't submit your feedback. not game-related.",
        ),
      }),
    );
  });
});
