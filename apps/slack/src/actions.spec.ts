jest.mock('./dm-client', () => {
  const dmClient = {
    attack: jest.fn(),
    spendSkillPoint: jest.fn(),
    equip: jest.fn(),
    drop: jest.fn(),
    unequip: jest.fn(),
    pickup: jest.fn(),
    getPlayer: jest.fn(),
    getLocationEntities: jest.fn(),
  };
  return { dmClient };
});

import type { ActionsBlock, KnownBlock, SectionBlock } from '@slack/types';
import { registerActions } from './actions';
import {
  COMMANDS,
  HELP_ACTIONS,
  MOVE_ACTIONS,
  ATTACK_ACTIONS,
  STAT_ACTIONS,
  PICKUP_ACTIONS,
  COMBAT_ACTIONS,
} from './commands';
import { getAllHandlers } from './handlers/handlerRegistry';
import { HandlerContext } from './handlers/types';
import {
  buildTargetSelectionMessage,
  MONSTER_SELECTION_BLOCK_ID,
  SELF_ATTACK_ERROR,
} from './handlers/attack';
import { ITEM_SELECTION_BLOCK_ID } from './handlers/pickup';
import { dmClient } from './dm-client';
import { PlayerAttribute, TargetType, AttackOrigin } from './dm-types';
import { toClientId } from './utils/clientId';

const mockedDmClient = dmClient as unknown as {
  attack: jest.Mock;
  spendSkillPoint: jest.Mock;
  equip: jest.Mock;
  drop: jest.Mock;
  unequip: jest.Mock;
  pickup: jest.Mock;
  getPlayer: jest.Mock;
  getLocationEntities: jest.Mock;
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
  chat: {
    postMessage: ChatPostMessageMock;
    update: ChatUpdateMock;
    postEphemeral?: jest.Mock<Promise<void>, unknown[]>;
  };
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
  postEphemeral: jest
    .fn<Promise<void>, unknown[]>()
    .mockResolvedValue(undefined),
});

type SlackActionHandler = (args: {
  ack: AckMock;
  body: {
    user?: { id?: string };
    trigger_id?: string;
    actions?: Array<Record<string, unknown>>;
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
  body?: {
    user?: { id?: string };
    view?: {
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
  client: MockSlackClient;
}) => Promise<void> | void;

const INVENTORY_EQUIP_ACTION = 'inventory_equip';
const INVENTORY_DROP_ACTION = 'inventory_drop';
const INVENTORY_UNEQUIP_ACTION = 'inventory_unequip';

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
    mockedDmClient.equip.mockReset();
    mockedDmClient.drop.mockReset();
    mockedDmClient.unequip.mockReset();
    mockedDmClient.pickup.mockReset();
    mockedDmClient.getPlayer.mockReset();
    mockedDmClient.getLocationEntities.mockReset();
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
      body: { user: { id: 'U123' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
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
        body: { user: { id: 'U99' }, team: { id: 'T1' } },
        client,
        context: { teamId: 'T1' },
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
      body: { user: { id: 'U456' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
    });
    expect(viewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({ trigger_id: 'T1' }),
    );

    viewsOpen.mockRejectedValueOnce(new Error('no views scope'));
    await actionHandlers[HELP_ACTIONS.CREATE]({
      ack,
      body: { trigger_id: 'T2', user: { id: 'U888' } },
      client,
      context: { teamId: 'T1' },
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
      body: {
        user: { id: 'U999' },
        team: { id: 'T1' },
        view: { state: { values: {} } },
      },
      client,
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
        playerMessages: [
          { slackId: 'U1', name: 'Hero', message: 'combat results' },
        ],
      },
    });

    await actionHandlers[ATTACK_ACTIONS.ATTACK_MONSTER]({
      ack,
      body: {
        user: { id: 'U1' },
        team: { id: 'T1' },
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
      context: { teamId: 'T1' },
    });

    expect(ack).toHaveBeenCalled();
    expect(mockedDmClient.attack).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
      input: {
        targetType: TargetType.Monster,
        targetId: 42,
        attackOrigin: AttackOrigin.TextPve,
      },
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D1',
        text: '⚔️ Combat initiated! Check your DMs for the results.',
      }),
    );
    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U1' });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'combat results' }),
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
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
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Attack failed: You are too far away',
      }),
    );
  });

  it('provides actionable guidance when the targeted player is missing', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'DM-U2' },
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
      message: 'Target player not found',
      data: null,
    });

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
                  value: 'P:U2',
                  text: { text: 'Player: Hero' },
                },
              },
            },
          },
        },
      },
      client,
      context: { teamId: 'T1' },
    });

    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: `Couldn't find a character for Hero. Ask them to check in with the bot using "${COMMANDS.HELP}" or create one with "${COMMANDS.NEW} <name>".`,
      }),
    );

    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U2' });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'DM-U2',
        text: expect.stringContaining(
          `<@U1> tried to attack you in *Mud*, but you don't have a character yet. Use "${COMMANDS.NEW} <name>"`,
        ),
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
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
    const inventoryHandler = jest.fn<Promise<void>, [HandlerContext]>();
    handlers[COMMANDS.STATS] = statsHandler;
    handlers[COMMANDS.MAP] = mapHandler;
    handlers[COMMANDS.INVENTORY] = inventoryHandler;

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
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
    });
    expect(statsHandler).toHaveBeenCalled();

    await actionHandlers[HELP_ACTIONS.MAP]({
      ack,
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
    });
    expect(mapHandler).toHaveBeenCalled();

    await actionHandlers[HELP_ACTIONS.INVENTORY]({
      ack,
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
    });
    expect(inventoryHandler).toHaveBeenCalled();
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
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
    });
    expect(southHandler).toHaveBeenCalled();

    await actionHandlers[MOVE_ACTIONS.WEST]({
      ack,
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
    });
    expect(westHandler).toHaveBeenCalled();

    await actionHandlers[MOVE_ACTIONS.EAST]({
      ack,
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
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
      context: { teamId: 'T1' },
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
        slackId: toClientId('U1', 'T1'),
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
      context: { teamId: 'T1' },
      respond,
    });

    expect(mockedDmClient.spendSkillPoint).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
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
      context: { teamId: 'T1' },
      respond,
    });

    expect(mockedDmClient.spendSkillPoint).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
      attribute: PlayerAttribute.Agility,
    });
    expect(client.chat.update).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({ response_type: 'ephemeral' }),
    );
  });

  describe('inventory actions', () => {
    it('opens the equip modal with allowed slots', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      const viewsOpen = jest.fn().mockResolvedValue(undefined) as ViewsOpenMock;
      const client: MockSlackClient = {
        conversations: {
          open: jest.fn() as ConversationsOpenMock,
        },
        chat: createChatMocks(),
        views: { open: viewsOpen },
      };

      await actionHandlers[INVENTORY_EQUIP_ACTION]({
        ack,
        body: {
          user: { id: 'U1' },
          trigger_id: 'TR1',
          actions: [
            {
              value: JSON.stringify({
                playerItemId: 7,
                allowedSlots: ['weapon', 'head'],
              }),
            },
          ],
        },
        client,
        context: { teamId: 'T1' },
      });

      expect(ack).toHaveBeenCalled();
      expect(viewsOpen).toHaveBeenCalledWith(
        expect.objectContaining({ trigger_id: 'TR1' }),
      );

      const { view } = viewsOpen.mock.calls[0][0] as {
        view: {
          private_metadata: string;
          blocks: Array<Record<string, unknown>>;
        };
      };
      expect(JSON.parse(view.private_metadata)).toEqual({
        playerItemId: 7,
        userId: 'U1',
        teamId: 'T1',
      });

      const slotBlock = view.blocks.find(
        (block) => block.block_id === 'slot_block',
      ) as {
        element?: {
          options?: Array<{ value: string; text?: { text: string } }>;
        };
      };

      expect(slotBlock?.element?.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: 'weapon',
            text: expect.objectContaining({ text: 'Weapon' }),
          }),
          expect.objectContaining({
            value: 'head',
            text: expect.objectContaining({ text: 'Head' }),
          }),
        ]),
      );
    });

    it('falls back to DM guidance when the equip modal fails', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      const viewsOpen = jest
        .fn()
        .mockRejectedValue(new Error('missing scope')) as ViewsOpenMock;
      const dmOpen = jest.fn().mockResolvedValue({
        channel: { id: 'DM-U1' },
      }) as ConversationsOpenMock;
      const chat = createChatMocks();
      const client: MockSlackClient = {
        conversations: { open: dmOpen },
        chat,
        views: { open: viewsOpen },
      };

      await actionHandlers[INVENTORY_EQUIP_ACTION]({
        ack,
        body: {
          user: { id: 'U1' },
          trigger_id: 'TR2',
          actions: [{ value: JSON.stringify({ playerItemId: 5 }) }],
        },
        client,
        context: { teamId: 'T1' },
      });

      expect(dmOpen).toHaveBeenCalledWith({ users: 'U1' });
      expect(chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'DM-U1',
          text: 'To equip item 5, type: `equip 5 <slot>`',
        }),
      );
    });

    it('handles equip submissions and posts the result', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      mockedDmClient.equip.mockResolvedValueOnce({ success: true });
      const dmOpen = jest.fn().mockResolvedValue({
        channel: { id: 'DM-U1' },
      }) as ConversationsOpenMock;
      const chat = createChatMocks();
      const client: MockSlackClient = {
        conversations: { open: dmOpen },
        chat,
      };

      await viewHandlers.inventory_equip_view({
        ack,
        view: {
          private_metadata: JSON.stringify({
            playerItemId: 9,
            userId: 'U1',
            teamId: 'T1',
          }),
          state: {
            values: {
              slot_block: {
                selected_slot: {
                  selected_option: { value: 'weapon' },
                },
              },
            },
          },
        },
        client,
        context: { teamId: 'T1' },
      });

      expect(mockedDmClient.equip).toHaveBeenCalledWith({
        slackId: toClientId('U1', 'T1'),
        playerItemId: 9,
        slot: 'weapon',
      });
      expect(chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'DM-U1',
          text: 'Equipped item 9 to weapon',
        }),
      );
    });

    it('drops an item and posts an ephemeral confirmation', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      mockedDmClient.drop.mockResolvedValueOnce({ success: true });
      const postEphemeral = jest.fn().mockResolvedValue(undefined);
      const chat = createChatMocks();
      chat.postEphemeral = postEphemeral;
      const client: MockSlackClient = {
        conversations: { open: jest.fn() as ConversationsOpenMock },
        chat,
      };

      await actionHandlers[INVENTORY_DROP_ACTION]({
        ack,
        body: {
          user: { id: 'U1' },
          channel: { id: 'C-DROP' },
          actions: [{ value: '12' }],
        },
        client,
        context: { teamId: 'T1' },
      });

      expect(mockedDmClient.drop).toHaveBeenCalledWith({
        slackId: toClientId('U1', 'T1'),
        playerItemId: 12,
      });
      expect(postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C-DROP',
          user: 'U1',
          text: 'Dropped item 12.',
        }),
      );
    });

    it('reports unequip errors in-channel', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      mockedDmClient.unequip.mockResolvedValueOnce({
        success: false,
        message: 'no slot',
      });
      const postEphemeral = jest.fn().mockResolvedValue(undefined);
      const chat = createChatMocks();
      chat.postEphemeral = postEphemeral;
      const client: MockSlackClient = {
        conversations: { open: jest.fn() as ConversationsOpenMock },
        chat,
      };

      await actionHandlers[INVENTORY_UNEQUIP_ACTION]({
        ack,
        body: {
          user: { id: 'U1' },
          channel: { id: 'C-UNEQUIP' },
          actions: [{ value: '55' }],
        },
        client,
        context: { teamId: 'T1' },
      });

      expect(postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C-UNEQUIP',
          user: 'U1',
          text: 'Failed to unequip: no slot',
        }),
      );
    });
  });

  describe('pickup actions', () => {
    it('updates the pickup message and notifies nearby players', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      mockedDmClient.pickup.mockResolvedValueOnce({
        success: true,
        item: { itemName: 'Health Potion', quantity: 2, quality: 'common' },
      });
      mockedDmClient.getPlayer.mockResolvedValueOnce({
        data: { name: 'Hero', x: 3, y: 4 },
      });
      mockedDmClient.getLocationEntities.mockResolvedValueOnce({
        players: [{ slackId: 'U2' }],
      });

      const update = jest.fn().mockResolvedValue(undefined) as ChatUpdateMock;
      const postMessage = jest
        .fn()
        .mockResolvedValue(undefined) as ChatPostMessageMock;
      const chat = createChatMocks();
      chat.update = update;
      chat.postMessage = postMessage;
      const dmOpen = jest
        .fn()
        .mockImplementation(({ users }: { users: string }) => {
          if (users === 'U1') {
            return Promise.resolve({ channel: { id: 'DM-U1' } });
          }
          if (users === 'U2') {
            return Promise.resolve({ channel: { id: 'DM-U2' } });
          }
          return Promise.resolve({ channel: { id: 'DM-OTHER' } });
        }) as ConversationsOpenMock;
      const client: MockSlackClient = {
        conversations: { open: dmOpen },
        chat,
      };

      const messageBlocks: KnownBlock[] = [
        {
          type: 'actions',
          block_id: ITEM_SELECTION_BLOCK_ID,
          elements: [],
        } as unknown as KnownBlock,
      ];

      await actionHandlers[PICKUP_ACTIONS.PICKUP]({
        ack,
        body: {
          user: { id: 'U1' },
          channel: { id: 'C-PICK' },
          message: { ts: 'TS1', blocks: messageBlocks },
          state: {
            values: {
              pick_block: {
                [PICKUP_ACTIONS.ITEM_SELECT]: {
                  selected_option: {
                    value: 'W:55',
                    text: { text: 'Health Potion' },
                  },
                },
              },
            },
          },
        },
        client,
        context: { teamId: 'T1' },
      });

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C-PICK',
          ts: 'TS1',
          text: 'Picking up item...',
        }),
      );
      const updatedBlocks = (
        update.mock.calls[0][0] as {
          blocks: KnownBlock[];
        }
      ).blocks;
      const progressBlock = updatedBlocks.find(
        (block) => block.block_id === ITEM_SELECTION_BLOCK_ID,
      ) as SectionBlock;
      expect(progressBlock?.text?.text).toBe('Picking up item...');

      expect(dmOpen).toHaveBeenCalledWith({ users: 'U1' });
      expect(dmOpen).toHaveBeenCalledWith({ users: 'U2' });
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'DM-U1',
          text: 'You have picked up 2 × Common Health Potion. Check your `inventory` next.',
        }),
      );
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'DM-U2',
          text: 'Hero picked something up from the ground.',
        }),
      );
    });
  });

  describe('combat log actions', () => {
    it('formats multiline combat logs with readable bullets', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      const update = jest.fn().mockResolvedValue(undefined) as ChatUpdateMock;
      const chat = createChatMocks();
      chat.update = update;
      const client: MockSlackClient = {
        conversations: { open: jest.fn() as ConversationsOpenMock },
        chat,
      };

      const fullText =
        '**Combat Log:**Round 1 You attack: swing\nDamage roll: 7\nRound 2 Wild Boar attacks: gore\nDamage roll: 8';

      await actionHandlers[COMBAT_ACTIONS.SHOW_LOG]({
        ack,
        body: {
          channel: { id: 'C-COMBAT' },
          message: {
            ts: 'TS-COMBAT',
            text: fullText,
            blocks: [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: 'Summary' },
              } as unknown as KnownBlock,
            ],
          },
        },
        client,
        context: { teamId: 'T1' },
      });

      const payload = update.mock.calls[0][0] as {
        blocks: KnownBlock[];
      };
      const detailedBlock = payload.blocks.find(
        (block) =>
          block.type === 'section' &&
          (block as SectionBlock).text?.text?.includes('Round 1'),
      ) as SectionBlock;

      expect(detailedBlock?.text?.text).toContain(
        '• Round 1: You attack: swing\n    Damage roll: 7',
      );
      expect(detailedBlock?.text?.text).toContain(
        '• Round 2: Wild Boar attacks: gore',
      );

      const actionsBlock = payload.blocks.find(
        (block) => block.type === 'actions',
      ) as ActionsBlock;
      expect(actionsBlock?.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action_id: COMBAT_ACTIONS.HIDE_LOG,
            text: expect.objectContaining({ text: 'Hide combat log' }),
          }),
        ]),
      );
    });

    it('falls back to a code block when no rounds are detected', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      const update = jest.fn().mockResolvedValue(undefined) as ChatUpdateMock;
      const chat = createChatMocks();
      chat.update = update;
      const client: MockSlackClient = {
        conversations: { open: jest.fn() as ConversationsOpenMock },
        chat,
      };

      await actionHandlers[COMBAT_ACTIONS.SHOW_LOG]({
        ack,
        body: {
          channel: { id: 'C-COMBAT' },
          message: {
            ts: 'TS-COMBAT',
            text: 'Summary only',
            blocks: [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: 'Summary' },
              } as unknown as KnownBlock,
            ],
          },
        },
        client,
        context: { teamId: 'T1' },
      });

      const payload = update.mock.calls[0][0] as {
        blocks: KnownBlock[];
      };
      const fallbackBlock = payload.blocks.find(
        (block) =>
          block.type === 'section' &&
          (block as SectionBlock).text?.text?.includes('```Summary only```'),
      );
      expect(fallbackBlock).toBeDefined();
    });

    it('restores the summary view when hiding the combat log', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      const update = jest.fn().mockResolvedValue(undefined) as ChatUpdateMock;
      const chat = createChatMocks();
      chat.update = update;
      const client: MockSlackClient = {
        conversations: { open: jest.fn() as ConversationsOpenMock },
        chat,
      };

      await actionHandlers[COMBAT_ACTIONS.HIDE_LOG]({
        ack,
        body: {
          channel: { id: 'C-COMBAT' },
          message: {
            ts: 'TS-COMBAT',
            text: 'Summary',
            blocks: [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: 'Summary details' },
              } as unknown as KnownBlock,
              {
                type: 'actions',
                elements: [],
              } as unknown as KnownBlock,
            ],
          },
        },
        client,
        context: { teamId: 'T1' },
      });

      const payload = update.mock.calls[0][0] as {
        blocks: KnownBlock[];
      };
      const actionsBlock = payload.blocks.find(
        (block) => block.type === 'actions',
      ) as ActionsBlock;
      expect(actionsBlock?.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action_id: COMBAT_ACTIONS.SHOW_LOG,
            text: expect.objectContaining({ text: 'View full combat log' }),
          }),
        ]),
      );
    });
  });
});
