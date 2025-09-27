import { registerActions } from './actions';
import { COMMANDS, HELP_ACTIONS, MOVE_ACTIONS } from './commands';
import { getAllHandlers } from './handlers/handlerRegistry';
import type { HandlerContext } from './handlers/types';

type AckMock = jest.Mock<Promise<void>, unknown[]>;
type ConversationsOpenMock = jest.Mock<
  Promise<{ channel: { id: string } }>,
  unknown[]
>;
type ChatPostMessageMock = jest.Mock<Promise<void>, unknown[]>;
type ViewsOpenMock = jest.Mock<Promise<void>, unknown[]>;

type MockSlackClient = {
  conversations: { open: ConversationsOpenMock };
  chat: { postMessage: ChatPostMessageMock };
  views?: { open: ViewsOpenMock };
};

type SlackActionHandler = (args: {
  ack: AckMock;
  body: { user?: { id?: string }; trigger_id?: string };
  client: MockSlackClient;
}) => Promise<void> | void;

type SlackViewHandler = (args: {
  ack: AckMock;
  body: {
    user?: { id?: string };
    view?: {
      state?: {
        values?: Record<string, Record<string, { value?: string | null }>>;
      };
    };
  };
  client: MockSlackClient;
}) => Promise<void> | void;

describe('registerActions', () => {
  const handlers = getAllHandlers();
  let actionHandlers: Record<string, SlackActionHandler>;
  let viewHandlers: Record<string, SlackViewHandler>;

  const resetHandlers = () => {
    for (const key of Object.keys(handlers)) {
      delete handlers[key];
    }
  };

  beforeEach(() => {
    resetHandlers();
    actionHandlers = {};
    viewHandlers = {};
    const app = {
      action: jest.fn((actionId: string, handler: SlackActionHandler) => {
        actionHandlers[actionId] = handler;
      }),
      view: jest.fn((callbackId: string, handler: SlackViewHandler) => {
        viewHandlers[callbackId] = handler;
      }),
    };

    registerActions(app as unknown as import('@slack/bolt').App);
  });

  afterEach(() => {
    resetHandlers();
  });

  it('dispatches help quick actions via DM', async () => {
    const lookHandler = jest
      .fn<Promise<void>, [HandlerContext]>()
      .mockImplementation(async (ctx) => {
        await ctx.say({ text: 'look result' });
      });
    handlers[COMMANDS.LOOK] = async (ctx) => lookHandler(ctx);

    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest
          .fn()
          .mockResolvedValue({
            channel: { id: 'C1' },
          }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    await actionHandlers[HELP_ACTIONS.LOOK]({
      ack,
      body: { user: { id: 'U123' } },
      client,
    });

    expect(ack).toHaveBeenCalled();
    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U123' });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C1' }),
    );
    expect(lookHandler).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'U123', text: COMMANDS.LOOK }),
    );
  });

  it('sends movement commands when buttons are clicked', async () => {
    const northHandler = jest
      .fn<Promise<void>, [HandlerContext]>()
      .mockImplementation(async (ctx) => {
        await ctx.say({ text: 'move north' });
      });
    handlers[COMMANDS.NORTH] = async (ctx) => northHandler(ctx);

    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest
          .fn()
          .mockResolvedValue({
            channel: { id: 'C2' },
          }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    await actionHandlers[MOVE_ACTIONS.NORTH]({
      ack,
      body: { user: { id: 'U456' } },
      client,
    });

    expect(northHandler).toHaveBeenCalled();
    expect(client.chat.postMessage).toHaveBeenCalled();
  });

  it('opens the create character modal and falls back to DM on failure', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const viewsOpen = jest.fn().mockResolvedValue(undefined) as ViewsOpenMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest
          .fn()
          .mockResolvedValue({
            channel: { id: 'C3' },
          }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
      views: { open: viewsOpen },
    };

    await actionHandlers[HELP_ACTIONS.CREATE]({
      ack,
      body: { trigger_id: 'T1', user: { id: 'U777' } },
      client,
    });
    expect(viewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({ trigger_id: 'T1' }),
    );

    viewsOpen.mockRejectedValueOnce(new Error('no views scope'));
    await actionHandlers[HELP_ACTIONS.CREATE]({
      ack,
      body: { trigger_id: 'T2', user: { id: 'U888' } },
      client,
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C3' }),
    );
  });

  it('validates create view submissions and invokes NEW handler', async () => {
    const newHandler = jest
      .fn<Promise<void>, [HandlerContext]>()
      .mockImplementation(async (ctx) => {
        await ctx.say({ text: 'created' });
      });
    handlers[COMMANDS.NEW] = async (ctx) => newHandler(ctx);
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest
          .fn()
          .mockResolvedValue({
            channel: { id: 'C4' },
          }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    await viewHandlers.create_character_view({
      ack,
      body: { user: { id: 'U999' }, view: { state: { values: {} } } },
      client,
    });

    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        response_action: 'errors',
        errors: expect.objectContaining({
          create_name_block: expect.any(String),
        }),
      }),
    );
    expect(newHandler).not.toHaveBeenCalled();

    ack.mockClear();
    await viewHandlers.create_character_view({
      ack,
      body: {
        user: { id: 'U999' },
        view: {
          state: {
            values: {
              create_name_block: { character_name: { value: '  Hero  ' } },
            },
          },
        },
      },
      client,
    });

    expect(newHandler).toHaveBeenCalledWith(
      expect.objectContaining({ text: `${COMMANDS.NEW} Hero` }),
    );
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C4' }),
    );
  });
});
