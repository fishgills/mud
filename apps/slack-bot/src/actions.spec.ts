jest.mock('./dm-client', () => {
  const dmClient = {
    attack: jest.fn(),
    spendSkillPoint: jest.fn(),
  };
  return { dmClient };
});

import type {
  ActionsBlock,
  Button,
  KnownBlock,
  SectionBlock,
} from '@slack/types';
import { registerActions } from './actions';
import {
  COMMANDS,
  HELP_ACTIONS,
  MOVE_ACTIONS,
  ATTACK_ACTIONS,
  STAT_ACTIONS,
} from './commands';
import { getAllHandlers } from './handlers/handlerRegistry';
import { HandlerContext } from './handlers/types';
import {
  buildTargetSelectionMessage,
  MONSTER_SELECTION_BLOCK_ID,
  SELF_ATTACK_ERROR,
} from './handlers/attack';
import { dmClient } from './dm-client';
import { PlayerAttribute, TargetType } from './dm-types';
import { toClientId } from './utils/clientId';

const mockedDmClient = dmClient as unknown as {
  attack: jest.Mock;
  spendSkillPoint: jest.Mock;
};

type AckMock = jest.Mock<Promise<void>, unknown[]>;
type ConversationsOpenMock = jest.Mock<
  Promise<{ channel: { id: string } | null }>,
  unknown[]
>;
type ChatPostMessageMock = jest.Mock<Promise<void>, unknown[]>;
type ChatUpdateMock = jest.Mock<Promise<void>, unknown[]>;
type ViewsOpenMock = jest.Mock<Promise<void>, unknown[]>;
type FilesUploadV2Mock = jest.Mock<Promise<void>, unknown[]>;

type MockSlackClient = {
  conversations: { open: ConversationsOpenMock };
  chat: { postMessage: ChatPostMessageMock; update: ChatUpdateMock };
  views?: { open: ViewsOpenMock };
  files?: { uploadV2: FilesUploadV2Mock };
};

const createChatMocks = (): MockSlackClient['chat'] => ({
  postMessage: jest
    .fn<Promise<void>, unknown[]>()
    .mockResolvedValue(undefined) as ChatPostMessageMock,
  update: jest
    .fn<Promise<void>, unknown[]>()
    .mockResolvedValue(undefined) as ChatUpdateMock,
});

type SlackActionHandler = (args: {
  ack: AckMock;
  body: {
    user?: { id?: string };
    trigger_id?: string;
    state?: { values?: Record<string, Record<string, unknown>> };
    container?: { channel_id?: string; message_ts?: string };
    channel?: { id?: string };
    message?: { ts?: string; text?: string; blocks?: KnownBlock[] };
  };
  client: MockSlackClient;
  respond?: jest.Mock;
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
    mockedDmClient.attack.mockReset();
    mockedDmClient.spendSkillPoint.mockReset();
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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

  it('sends deep-dive help messages when detail buttons are clicked', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
    };

    const detailActions = [
      { id: HELP_ACTIONS.LEVELING, expected: 'Leveling & Progression' },
      { id: HELP_ACTIONS.COMBAT, expected: 'Combat Primer' },
      { id: HELP_ACTIONS.ABILITIES, expected: 'Abilities & Power' },
    ];

    for (const { id, expected } of detailActions) {
      client.chat.postMessage.mockClear();
      client.conversations.open.mockClear();

      await actionHandlers[id]({
        ack,
        body: { user: { id: 'U99' } },
        client,
      });

      expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U99' });
      expect(client.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C1',
          text: expect.stringContaining(expected),
        }),
      );
    }
    expect(ack).toHaveBeenCalledTimes(detailActions.length);
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
          channel: { id: 'C2' },
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
    };

    const selectionMessage = buildTargetSelectionMessage(
      [{ id: '42', name: 'Goblin' }],
      [],
    );

    mockedDmClient.attack.mockResolvedValue({
      success: true,
      data: {
        winnerName: 'Hero',
        roundsCompleted: 3,
        xpGained: 50,
        goldGained: 1,
        message: 'Hero strikes down the goblin.',
      },
    });

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {
        user: { id: 'U1' },
        container: { channel_id: 'D1' },
        message: {
          ts: '158456',
          text: selectionMessage.text,
          blocks: selectionMessage.blocks as KnownBlock[],
        },
        state: {
          values: {
            attack_monster_selection_block: {
              [ATTACK_ACTIONS.MONSTER_SELECT]: {
                selected_option: {
                  value: 'M:42',
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
    expect(mockedDmClient.attack).toHaveBeenCalledWith({
      slackId: toClientId('U1'),
      input: { targetType: TargetType.Monster, targetId: 42 },
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D1',
        text: '⚔️ Combat initiated! Check your DMs for the results.',
      }),
    );
    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'D1', ts: '158456' }),
    );

    const updatePayload = client.chat.update.mock.calls[0][0] as {
      blocks?: KnownBlock[];
      text?: string;
    };
    const actionsBlock = updatePayload.blocks?.find(
      (block) => block.type === 'actions',
    ) as ActionsBlock | undefined;
    expect(actionsBlock).toBeUndefined();
    const progressBlock = updatePayload.blocks?.find(
      (block) =>
        block.block_id === MONSTER_SELECTION_BLOCK_ID &&
        block.type === 'section',
    ) as SectionBlock | undefined;
    expect(progressBlock?.text?.text).toBe('Attacking Goblin...');
    expect(updatePayload.text).toBe('Attacking Goblin...');
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
          channel: null,
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
      chat: createChatMocks(),
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
          channel: null,
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
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
      chat: createChatMocks(),
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
          channel: null,
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {},
      client,
    });

    expect(mockedDmClient.attack).not.toHaveBeenCalled();
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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

    expect(mockedDmClient.attack).not.toHaveBeenCalled();
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Please select a monster to attack first!',
      }),
    );
  });

  it('prevents selecting yourself as a player target', async () => {
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {
        user: { id: 'U1' },
        channel: { id: 'D1' },
        state: {
          values: {
            attack_monster_selection_block: {
              [ATTACK_ACTIONS.MONSTER_SELECT]: {
                selected_option: {
                  value: 'P:U1',
                  text: { text: 'Player: Hero' },
                },
              },
            },
          },
        },
      },
      client,
    });

    expect(mockedDmClient.attack).not.toHaveBeenCalled();
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: SELF_ATTACK_ERROR,
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    mockedDmClient.attack.mockResolvedValueOnce({
      success: false,
      message: 'You are too far away',
      data: null,
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
                  value: 'M:99',
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    mockedDmClient.attack.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      data: null,
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
                  value: 'M:99',
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

  it('handles attack error with network failure', async () => {
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    mockedDmClient.attack.mockRejectedValueOnce(new Error('Network error'));

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
                  value: 'M:99',
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
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
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    await actionHandlers[ATTACK_ACTIONS.MONSTER_SELECT]({
      ack,
      body: {},
      client,
    });

    expect(ack).toHaveBeenCalled();
  });

  it('spends skill points and updates the stats message', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const respond = jest.fn();
    mockedDmClient.spendSkillPoint.mockResolvedValue({
      success: true,
      message: null,
      data: {
        id: '1',
        slackId: toClientId('U1'),
        name: 'Hero',
        hp: 18,
        maxHp: 18,
        strength: 12,
        agility: 10,
        health: 11,
        gold: 5,
        xp: 150,
        level: 2,
        skillPoints: 1,
      },
    });

    const client: MockSlackClient = {
      conversations: {
        open: jest.fn() as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    await actionHandlers[STAT_ACTIONS.INCREASE_STRENGTH]({
      ack,
      body: {
        user: { id: 'U1' },
        channel: { id: 'C1' },
        message: { ts: '123' },
      },
      client,
      respond,
    });

    expect(mockedDmClient.spendSkillPoint).toHaveBeenCalledWith({
      slackId: toClientId('U1'),
      attribute: PlayerAttribute.Strength,
    });
    expect(client.chat.update).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C1', ts: '123' }),
    );
    expect(respond).not.toHaveBeenCalled();
  });

  it('reports errors when spending skill points fails', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const respond = jest.fn();
    mockedDmClient.spendSkillPoint.mockResolvedValue({
      success: false,
      message: 'no points',
      data: null,
    });

    const client: MockSlackClient = {
      conversations: {
        open: jest.fn() as ConversationsOpenMock,
      },
      chat: {
        postMessage: jest
          .fn()
          .mockResolvedValue(undefined) as ChatPostMessageMock,
        update: jest.fn().mockResolvedValue(undefined) as ChatUpdateMock,
      },
    };

    await actionHandlers[STAT_ACTIONS.INCREASE_AGILITY]({
      ack,
      body: {
        user: { id: 'U1' },
        channel: { id: 'C1' },
        message: { ts: '123' },
      },
      client,
      respond,
    });

    expect(mockedDmClient.spendSkillPoint).toHaveBeenCalledWith({
      slackId: toClientId('U1'),
      attribute: PlayerAttribute.Agility,
    });
    expect(client.chat.update).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ response_type: 'ephemeral' }),
    );
  });
});
