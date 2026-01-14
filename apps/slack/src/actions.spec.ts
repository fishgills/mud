jest.mock('./dm-client', () => {
  const dmClient = {
    attack: jest.fn(),
    spendSkillPoint: jest.fn(),
    createPlayer: jest.fn(),
    rerollPlayerStats: jest.fn(),
    completePlayer: jest.fn(),
    deletePlayer: jest.fn(),
    equip: jest.fn(),
    unequip: jest.fn(),
    getPlayer: jest.fn(),
    getMonsters: jest.fn(),
    continueRun: jest.fn(),
    finishRun: jest.fn(),
  };
  return {
    dmClient,
    getLeaderboard: jest.fn().mockResolvedValue({ success: true, data: [] }),
    getPlayer: jest.fn().mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Hero' },
    }),
  };
});

import type { ActionsBlock, KnownBlock, SectionBlock } from '@slack/types';
import { registerActions } from './actions';
import {
  COMMANDS,
  HELP_ACTIONS,
  ATTACK_ACTIONS,
  STAT_ACTIONS,
  COMBAT_ACTIONS,
} from './commands';
import { getAllHandlers } from './handlers/handlerRegistry';
import { HandlerContext } from './handlers/types';
import {
  buildTargetSelectionMessage,
  MONSTER_SELECTION_BLOCK_ID,
  SELF_ATTACK_ERROR,
} from './handlers/attack';
import { dmClient } from './dm-client';
import { PlayerAttribute, TargetType, AttackOrigin } from './dm-types';

const mockedDmClient = dmClient as unknown as {
  attack: jest.Mock;
  spendSkillPoint: jest.Mock;
  createPlayer: jest.Mock;
  rerollPlayerStats: jest.Mock;
  completePlayer: jest.Mock;
  deletePlayer: jest.Mock;
  equip: jest.Mock;
  unequip: jest.Mock;
  getPlayer: jest.Mock;
  getMonsters: jest.Mock;
  continueRun: jest.Mock;
  finishRun: jest.Mock;
};

type AckMock = jest.Mock<Promise<void>, unknown[]>;
type ConversationsOpenMock = jest.Mock<
  Promise<{ channel: { id: string } | null }>,
  unknown[]
>;
type ChatPostMessageMock = jest.Mock<Promise<void>, unknown[]>;
type ChatUpdateMock = jest.Mock<Promise<void>, unknown[]>;
type ViewsOpenMock = jest.Mock<Promise<void>, unknown[]>;
type ViewsPublishMock = jest.Mock<Promise<void>, unknown[]>;
type ViewsUpdateMock = jest.Mock<Promise<void>, unknown[]>;
type ViewsCloseMock = jest.Mock<Promise<void>, unknown[]>;
type FilesUploadV2Mock = jest.Mock<Promise<void>, unknown[]>;

type MockSlackClient = {
  conversations: { open: ConversationsOpenMock };
  chat: {
    postMessage: ChatPostMessageMock;
    update: ChatUpdateMock;
    postEphemeral?: jest.Mock<Promise<void>, unknown[]>;
  };
  views?: {
    open?: ViewsOpenMock;
    publish?: ViewsPublishMock;
    update?: ViewsUpdateMock;
    close?: ViewsCloseMock;
  };
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
    mockedDmClient.createPlayer.mockReset();
    mockedDmClient.rerollPlayerStats.mockReset();
    mockedDmClient.completePlayer.mockReset();
    mockedDmClient.deletePlayer.mockReset();
    mockedDmClient.equip.mockReset();
    mockedDmClient.unequip.mockReset();
    mockedDmClient.getPlayer.mockReset();
    mockedDmClient.getMonsters.mockReset();
    mockedDmClient.continueRun.mockReset();
    mockedDmClient.finishRun.mockReset();
    const app = {
      action: jest.fn((actionId: string, handler: SlackActionHandler) => {
        actionHandlers[actionId] = handler;
      }),
      view: jest.fn((callbackId: string, handler: SlackViewHandler) => {
        viewHandlers[callbackId] = handler;
      }),
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
      },
    };

    registerActions(app as unknown as import('@slack/bolt').App);
  });

  afterEach(() => {
    resetHandlers();
  });

  it('dispatches help quick actions via DM', async () => {
    const statsHandler = jest
      .fn<Promise<void>, [HandlerContext]>()
      .mockImplementation(async (ctx) => {
        await ctx.say({ text: 'stats result' });
      });
    handlers[COMMANDS.STATS] = async (ctx) => statsHandler(ctx);

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
      body: { user: { id: 'U123' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
    });

    expect(ack).toHaveBeenCalled();
    expect(client.conversations.open).toHaveBeenCalledWith({ users: 'U123' });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'C1' }),
    );
    expect(statsHandler).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'U123', text: COMMANDS.STATS }),
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

  it('validates create view submissions and pushes the stats modal', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    mockedDmClient.createPlayer.mockResolvedValue({
      success: true,
      data: {
        name: 'Hero',
        strength: 12,
        agility: 10,
        health: 11,
        maxHp: 18,
      },
    });
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

    expect(mockedDmClient.createPlayer).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U999',
      name: 'Hero',
    });
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        response_action: 'push',
        view: expect.objectContaining({
          callback_id: 'create_character_finalize_view',
        }),
      }),
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

    const selectionMessage = buildTargetSelectionMessage([
      { id: '42', name: 'Goblin' },
    ]);

    mockedDmClient.attack.mockResolvedValue({
      success: true,
      data: {
        winnerName: 'Hero',
        roundsCompleted: 3,
        xpGained: 50,
        goldGained: 1,
        message: 'Hero strikes down the goblin.',
        playerMessages: [
          {
            teamId: 'T1',
            userId: 'U1',
            name: 'Hero',
            message: 'combat results',
          },
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
      teamId: 'T1',
      userId: 'U1',
      input: {
        targetType: TargetType.Monster,
        targetId: 42,
        attackOrigin: AttackOrigin.TextPve,
      },
    });
    // No immediate DM; event bus handles participant notifications
    expect(client.chat.postMessage).not.toHaveBeenCalled();
    // Combat messages are now delivered via the notification service (Redis), not directly via client
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

    await actionHandlers[HELP_ACTIONS.STATS]({
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
    handlers[COMMANDS.STATS] = handler;

    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: null,
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
    };

    await actionHandlers[HELP_ACTIONS.STATS]({
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
    delete handlers[COMMANDS.STATS];

    await actionHandlers[HELP_ACTIONS.STATS]({
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

    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        response_action: 'errors',
        errors: expect.objectContaining({
          create_name_block: expect.any(String),
        }),
      }),
    );
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
                  value: 'P:T1:U1',
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
                  value: 'P:T1:U2',
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
    const inventoryHandler = jest.fn<Promise<void>, [HandlerContext]>();
    handlers[COMMANDS.STATS] = statsHandler;
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

    await actionHandlers[HELP_ACTIONS.INVENTORY]({
      ack,
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
    });
    expect(inventoryHandler).toHaveBeenCalled();
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

  it('opens the level-up modal when the action is clicked', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const viewsOpen = jest.fn().mockResolvedValue(undefined) as ViewsOpenMock;
    mockedDmClient.getPlayer.mockResolvedValue({
      success: true,
      data: { skillPoints: 1, name: 'Hero' },
    });

    const client: MockSlackClient = {
      conversations: {
        open: jest.fn() as ConversationsOpenMock,
      },
      chat: createChatMocks(),
      views: { open: viewsOpen },
    };

    await actionHandlers[STAT_ACTIONS.OPEN_LEVEL_UP]({
      ack,
      body: {
        user: { id: 'U1' },
        trigger_id: 'TRIGGER',
      },
      client,
      context: { teamId: 'T1' },
    });

    expect(viewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({ trigger_id: 'TRIGGER' }),
    );
  });

  it('spends a skill point on level-up submission and posts stats', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    mockedDmClient.spendSkillPoint.mockResolvedValue({
      success: true,
      message: null,
      data: {
        id: '1',
        teamId: 'T1',
        userId: 'U1',
        name: 'Hero',
        hp: 18,
        maxHp: 18,
        strength: 12,
        agility: 10,
        health: 11,
        gold: 5,
        xp: 150,
        level: 2,
        skillPoints: 0,
      },
    });

    const client: MockSlackClient = {
      conversations: {
        open: jest
          .fn()
          .mockResolvedValue({
            channel: { id: 'DM1' },
          }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
      views: { publish: jest.fn() as ViewsPublishMock },
    };

    await viewHandlers.level_up_view({
      ack,
      view: {
        private_metadata: JSON.stringify({ teamId: 'T1', userId: 'U1' }),
        state: {
          values: {
            attribute_block: {
              selected_attribute: {
                selected_option: { value: PlayerAttribute.Strength },
              },
            },
          },
        },
      },
      client,
      context: { teamId: 'T1' },
    });

    expect(mockedDmClient.spendSkillPoint).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
      attribute: PlayerAttribute.Strength,
    });
    expect(client.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'DM1' }),
    );
  });

  it('reports errors when level-up submission fails', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    mockedDmClient.spendSkillPoint.mockResolvedValue({
      success: false,
      message: 'no points',
      data: null,
    });

    const client: MockSlackClient = {
      conversations: {
        open: jest.fn() as ConversationsOpenMock,
      },
      chat: createChatMocks(),
    };

    await viewHandlers.level_up_view({
      ack,
      view: {
        private_metadata: JSON.stringify({ teamId: 'T1', userId: 'U1' }),
        state: {
          values: {
            attribute_block: {
              selected_attribute: {
                selected_option: { value: PlayerAttribute.Agility },
              },
            },
          },
        },
      },
      client,
      context: { teamId: 'T1' },
    });

    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        response_action: 'errors',
        errors: expect.any(Object),
      }),
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
      mockedDmClient.equip.mockResolvedValueOnce({
        success: true,
        data: { item: { name: 'Shortsword' }, quality: 'Common' },
      });
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
        teamId: 'T1',
        userId: 'U1',
        playerItemId: 9,
        slot: 'weapon',
      });
      expect(chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'DM-U1',
          text: 'Equipped Common Shortsword to weapon.',
        }),
      );
    });

    it('reports unequip success in-channel', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      mockedDmClient.unequip.mockResolvedValueOnce({
        success: true,
        data: { item: { name: 'Shortsword' }, quality: 'Common' },
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
          text: 'Unequipped Common Shortsword.',
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
