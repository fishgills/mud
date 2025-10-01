jest.mock('./gql-client', () => {
  const dmSdk = {
    Attack: jest.fn(),
  };
  return { dmSdk };
});

import { registerActions } from './actions';
import {
  COMMANDS,
  HELP_ACTIONS,
  MOVE_ACTIONS,
  ATTACK_ACTIONS,
} from './commands';
import { getAllHandlers } from './handlers/handlerRegistry';
import { HandlerContext } from './handlers/types';
import { dmSdk } from './gql-client';
import { TargetType } from './generated/dm-graphql';

const mockedDmSdk = dmSdk as unknown as { Attack: jest.Mock };

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
  body: {
    user?: { id?: string };
    trigger_id?: string;
    state?: { values?: Record<string, Record<string, unknown>> };
    container?: { channel_id?: string };
    channel?: { id?: string };
  };
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
    mockedDmSdk.Attack.mockReset();
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
        open: jest.fn().mockResolvedValue({
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
        open: jest.fn().mockResolvedValue({
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
        open: jest.fn().mockResolvedValue({
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
        open: jest.fn().mockResolvedValue({
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

  it('attacks the selected monster when the attack button is clicked', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C5' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    mockedDmSdk.Attack.mockResolvedValueOnce({
      attack: {
        success: true,
        message: 'done',
        data: {
          winnerName: 'Hero',
          loserName: 'Goblin',
          totalDamageDealt: 5,
          roundsCompleted: 3,
          xpGained: 2,
          goldGained: 1,
          message: 'Hero strikes down the goblin.',
        },
      },
    });

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {
        user: { id: 'U1' },
        container: { channel_id: 'D1' },
        state: {
          values: {
            attack_monster_selection_block: {
              [ATTACK_ACTIONS.MONSTER_SELECT]: {
                selected_option: {
                  value: '42',
                  text: { text: 'Goblin' },
                },
              },
            },
          },
        },
      },
      client,
    });

    expect(ack).toHaveBeenCalled();
    expect(mockedDmSdk.Attack).toHaveBeenCalledWith({
      slackId: 'U1',
      input: { targetType: TargetType.Monster, targetId: 42 },
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D1',
        text: expect.stringContaining('You attacked Goblin!'),
      }),
    );
  });

  it('handles missing userId in help actions', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
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
      body: {},
      client,
    });

    expect(ack).toHaveBeenCalled();
    expect(client.conversations.open).not.toHaveBeenCalled();
  });

  it('handles missing userId in movement actions', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
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
      body: {},
      client,
    });

    expect(ack).toHaveBeenCalled();
    expect(client.conversations.open).not.toHaveBeenCalled();
  });

  it('handles missing channel in dispatchCommandViaDM', async () => {
    const handler = jest.fn<Promise<void>, [HandlerContext]>();
    handlers[COMMANDS.LOOK] = handler;

    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: null as any,
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
      body: { user: { id: 'U1' } },
      client,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('handles missing handler in dispatchCommandViaDM', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    // Ensure no handler is registered
    delete handlers[COMMANDS.LOOK];

    await actionHandlers[HELP_ACTIONS.LOOK]({
      ack,
      body: { user: { id: 'U1' } },
      client,
    });

    expect(client.conversations.open).not.toHaveBeenCalled();
  });

  it('handles missing userId in CREATE action', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const viewsOpen = jest
      .fn()
      .mockRejectedValue(new Error('fail')) as ViewsOpenMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
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
      body: { trigger_id: 'T1' },
      client,
    });

    expect(viewsOpen).toHaveBeenCalled();
    expect(client.conversations.open).not.toHaveBeenCalled();
  });

  it('handles missing channel in CREATE fallback', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const viewsOpen = jest
      .fn()
      .mockRejectedValue(new Error('fail')) as ViewsOpenMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: null as any,
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
      body: { trigger_id: 'T1', user: { id: 'U1' } },
      client,
    });

    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it('handles missing userId in create_character_view', async () => {
    const newHandler = jest.fn<Promise<void>, [HandlerContext]>();
    handlers[COMMANDS.NEW] = newHandler;

    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
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
      body: {
        view: {
          state: {
            values: {
              create_name_block: { character_name: { value: 'Hero' } },
            },
          },
        },
      },
      client,
    });

    expect(newHandler).not.toHaveBeenCalled();
  });

  it('handles missing handler in create_character_view', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    delete handlers[COMMANDS.NEW];

    await viewHandlers.create_character_view({
      ack,
      body: {
        user: { id: 'U1' },
        view: {
          state: {
            values: {
              create_name_block: { character_name: { value: 'Hero' } },
            },
          },
        },
      },
      client,
    });

    expect(client.conversations.open).not.toHaveBeenCalled();
  });

  it('handles missing channel in create_character_view', async () => {
    const newHandler = jest.fn<Promise<void>, [HandlerContext]>();
    handlers[COMMANDS.NEW] = newHandler;

    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: null as any,
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
      body: {
        user: { id: 'U1' },
        view: {
          state: {
            values: {
              create_name_block: { character_name: { value: 'Hero' } },
            },
          },
        },
      },
      client,
    });

    expect(newHandler).not.toHaveBeenCalled();
  });

  it('handles missing userId or channelId in attack', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {},
      client,
    });

    expect(mockedDmSdk.Attack).not.toHaveBeenCalled();
  });

  it('handles missing monster selection in attack', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {
        user: { id: 'U1' },
        channel: { id: 'D1' },
        state: { values: {} },
      },
      client,
    });

    expect(mockedDmSdk.Attack).not.toHaveBeenCalled();
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Please select a monster to attack first!',
      }),
    );
  });

  it('handles attack failure', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    mockedDmSdk.Attack.mockResolvedValueOnce({
      attack: {
        success: false,
        message: 'You are too far away',
        data: null,
      },
    });

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {
        user: { id: 'U1' },
        channel: { id: 'D1' },
        state: {
          values: {
            attack_block: {
              [ATTACK_ACTIONS.MONSTER_SELECT]: {
                selected_option: {
                  value: '99',
                  text: { text: 'Dragon' },
                },
              },
            },
          },
        },
      },
      client,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Attack failed: You are too far away',
      }),
    );
  });

  it('handles missing combat data in successful attack', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    mockedDmSdk.Attack.mockResolvedValueOnce({
      attack: {
        success: true,
        message: 'ok',
        data: null,
      },
    });

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {
        user: { id: 'U1' },
        channel: { id: 'D1' },
        state: {
          values: {
            attack_block: {
              [ATTACK_ACTIONS.MONSTER_SELECT]: {
                selected_option: {
                  value: '99',
                  text: { text: 'Slime' },
                },
              },
            },
          },
        },
      },
      client,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Attack succeeded but no combat data returned.',
      }),
    );
  });

  it('handles attack error with GraphQL error message', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    mockedDmSdk.Attack.mockRejectedValueOnce(new Error('Network error'));

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {
        user: { id: 'U1' },
        channel: { id: 'D1' },
        state: {
          values: {
            attack_block: {
              [ATTACK_ACTIONS.MONSTER_SELECT]: {
                selected_option: {
                  value: '99',
                  text: { text: 'Orc' },
                },
              },
            },
          },
        },
      },
      client,
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D1',
        text: 'Network error',
      }),
    );
  });

  it('tests all other HELP_ACTIONS', async () => {
    const statsHandler = jest.fn<Promise<void>, [HandlerContext]>();
    const mapHandler = jest.fn<Promise<void>, [HandlerContext]>();
    handlers[COMMANDS.STATS] = statsHandler;
    handlers[COMMANDS.MAP] = mapHandler;

    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    await actionHandlers[HELP_ACTIONS.STATS]({
      ack,
      body: { user: { id: 'U1' } },
      client,
    });
    expect(statsHandler).toHaveBeenCalled();

    await actionHandlers[HELP_ACTIONS.MAP]({
      ack,
      body: { user: { id: 'U1' } },
      client,
    });
    expect(mapHandler).toHaveBeenCalled();
  });

  it('tests all other MOVE_ACTIONS', async () => {
    const southHandler = jest.fn<Promise<void>, [HandlerContext]>();
    const westHandler = jest.fn<Promise<void>, [HandlerContext]>();
    const eastHandler = jest.fn<Promise<void>, [HandlerContext]>();
    handlers[COMMANDS.SOUTH] = southHandler;
    handlers[COMMANDS.WEST] = westHandler;
    handlers[COMMANDS.EAST] = eastHandler;

    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    await actionHandlers[MOVE_ACTIONS.SOUTH]({
      ack,
      body: { user: { id: 'U1' } },
      client,
    });
    expect(southHandler).toHaveBeenCalled();

    await actionHandlers[MOVE_ACTIONS.WEST]({
      ack,
      body: { user: { id: 'U1' } },
      client,
    });
    expect(westHandler).toHaveBeenCalled();

    await actionHandlers[MOVE_ACTIONS.EAST]({
      ack,
      body: { user: { id: 'U1' } },
      client,
    });
    expect(eastHandler).toHaveBeenCalled();
  });

  it('acknowledges monster select action', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
      },
    };

    await actionHandlers[ATTACK_ACTIONS.MONSTER_SELECT]({
      ack,
      body: {},
      client,
    });

    expect(ack).toHaveBeenCalled();
  });
});
