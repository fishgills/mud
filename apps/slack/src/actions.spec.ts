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
    getPlayerItems: jest.fn().mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Hero', bag: [] },
    }),
    getCombatLog: jest.fn().mockResolvedValue({ success: false }),
  };
});

import type { ActionsBlock, KnownBlock, SectionBlock } from '@slack/types';
import { registerActions } from './actions';
import {
  COMMANDS,
  HELP_ACTIONS,
  STAT_ACTIONS,
  COMBAT_ACTIONS,
  RUN_ACTIONS,
} from './commands';
import { getAllHandlers } from './handlers/handlerRegistry';
import { dmClient, getCombatLog, getPlayerItems } from './dm-client';
import { PlayerAttribute } from './dm-types';

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
  getPlayerItems?: jest.Mock;
  getMonsters: jest.Mock;
  continueRun: jest.Mock;
  finishRun: jest.Mock;
};
const mockedGetCombatLog = getCombatLog as jest.Mock;

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

  it('opens the stats modal from help actions', async () => {
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { id: 1, name: 'Hero', skillPoints: 0 },
    });
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const viewsOpen = jest.fn().mockResolvedValue(undefined) as ViewsOpenMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
      views: { open: viewsOpen },
    };

    await actionHandlers[HELP_ACTIONS.STATS]({
      ack,
      body: { user: { id: 'U123' }, team: { id: 'T1' }, trigger_id: 'T1' },
      client,
      context: { teamId: 'T1' },
    });

    expect(ack).toHaveBeenCalled();
    expect(viewsOpen).toHaveBeenCalled();
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

  it('handles missing userId in help actions', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const viewsOpen = jest.fn().mockResolvedValue(undefined) as ViewsOpenMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
      views: { open: viewsOpen },
    };

    await actionHandlers[HELP_ACTIONS.STATS]({
      ack,
      body: {},
      client,
      context: { teamId: 'T1' },
    });

    expect(ack).toHaveBeenCalled();
    expect(viewsOpen).not.toHaveBeenCalled();
  });

  it('does not open stats modal without a trigger id', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const viewsOpen = jest.fn().mockResolvedValue(undefined) as ViewsOpenMock;
    const client: MockSlackClient = {
      conversations: {
        open: jest.fn().mockResolvedValue({
          channel: { id: 'C1' },
        }) as ConversationsOpenMock,
      },
      chat: createChatMocks(),
      views: { open: viewsOpen },
    };

    await actionHandlers[HELP_ACTIONS.STATS]({
      ack,
      body: { user: { id: 'U1' }, team: { id: 'T1' } },
      client,
      context: { teamId: 'T1' },
    });

    expect(viewsOpen).not.toHaveBeenCalled();
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

  it('tests all other HELP_ACTIONS', async () => {
    const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
    const viewsOpen = jest.fn().mockResolvedValue(undefined) as ViewsOpenMock;
    mockedDmClient.getPlayer.mockResolvedValue({
      success: true,
      data: { skillPoints: 0, name: 'Hero' },
    });
    (getPlayerItems as jest.Mock).mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Hero', bag: [] },
    });
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
      views: { open: viewsOpen },
    };

    await actionHandlers[HELP_ACTIONS.STATS]({
      ack,
      body: { user: { id: 'U1' }, team: { id: 'T1' }, trigger_id: 'TRIGGER' },
      client,
      context: { teamId: 'T1' },
    });
    expect(viewsOpen).toHaveBeenCalled();

    await actionHandlers[HELP_ACTIONS.INVENTORY]({
      ack,
      body: {
        user: { id: 'U1' },
        team: { id: 'T1' },
        trigger_id: 'TRIGGER',
      },
      client,
      context: { teamId: 'T1' },
    });
    expect(viewsOpen).toHaveBeenCalledWith(
      expect.objectContaining({ trigger_id: 'TRIGGER' }),
    );
  });

  it('opens the character sheet modal when the action is clicked', async () => {
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

  it('spends a skill point from the character sheet modal', async () => {
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
        open: jest.fn() as ConversationsOpenMock,
      },
      chat: createChatMocks(),
      views: { publish: jest.fn() as ViewsPublishMock },
    };

    await viewHandlers.character_sheet_view({
      ack,
      view: {
        private_metadata: JSON.stringify({ teamId: 'T1', userId: 'U1' }),
        state: {
          values: {
            character_sheet_skill_points: {
              character_sheet_attribute: {
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
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ response_action: 'update' }),
    );
  });

  it('reports errors when character sheet submission fails', async () => {
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

    await viewHandlers.character_sheet_view({
      ack,
      view: {
        private_metadata: JSON.stringify({ teamId: 'T1', userId: 'U1' }),
        state: {
          values: {
            character_sheet_skill_points: {
              character_sheet_attribute: {
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
    it('equips items directly from inventory actions', async () => {
      const ack = jest.fn().mockResolvedValue(undefined) as AckMock;
      mockedDmClient.equip.mockResolvedValueOnce({
        success: true,
        data: { item: { name: 'Shortsword' }, quality: 'Common' },
      });
      const chat = createChatMocks();
      const client: MockSlackClient = {
        conversations: {
          open: jest.fn() as ConversationsOpenMock,
        },
        chat,
      };

      await actionHandlers[INVENTORY_EQUIP_ACTION]({
        ack,
        body: {
          user: { id: 'U1' },
          channel: { id: 'C-INV' },
          actions: [
            {
              value: JSON.stringify({
                playerItemId: 9,
                allowedSlots: ['weapon'],
              }),
            },
          ],
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
      expect(chat.postEphemeral).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C-INV',
          user: 'U1',
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

      mockedGetCombatLog.mockResolvedValueOnce({
        success: true,
        data: {
          combatId: 'combat-123',
          participant1: 'You',
          participant2: 'Wild Boar',
          initiativeRolls: [],
          firstAttacker: 'You',
          rounds: [
            {
              roundNumber: 1,
              attackerName: 'You',
              defenderName: 'Wild Boar',
              attackRating: 60,
              defenseRating: 40,
              hitChance: 0.72,
              hitRoll: 0.12,
              hit: true,
              weaponDamage: 3,
              coreDamage: 12,
              baseDamage: 15,
              mitigation: 0.2,
              damageAfterMitigation: 12,
              critChance: 0.05,
              critRoll: 0.99,
              critMultiplier: 1.5,
              crit: false,
              damage: 12,
              defenderHpAfter: 0,
              killed: true,
            },
          ],
          winner: 'You',
          loser: 'Wild Boar',
          xpAwarded: 10,
          goldAwarded: 2,
          timestamp: '2023-01-01T00:00:00Z',
        },
      });

      const fullText =
        '**Combat Log:**Round 1 You attack: swing\nDamage roll: 7\nRound 2 Wild Boar attacks: gore\nDamage roll: 8';

      await actionHandlers[COMBAT_ACTIONS.SHOW_LOG]({
        ack,
        body: {
          channel: { id: 'C-COMBAT' },
          actions: [{ value: 'combat-123' }],
          message: {
            ts: 'TS-COMBAT',
            text: fullText,
            blocks: [
              {
                type: 'section',
                text: { type: 'mrkdwn', text: 'Summary' },
              } as unknown as KnownBlock,
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    action_id: RUN_ACTIONS.CONTINUE,
                    text: { type: 'plain_text', text: 'Continue' },
                  },
                  {
                    type: 'button',
                    action_id: RUN_ACTIONS.FINISH,
                    text: { type: 'plain_text', text: 'Finish Raid' },
                  },
                  {
                    type: 'button',
                    action_id: COMBAT_ACTIONS.SHOW_LOG,
                    text: { type: 'plain_text', text: 'View full combat log' },
                  },
                ],
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
        '• Round 1: You strike: AR 60 vs DR 40 (hit 72%) -> HIT',
      );
      expect(detailedBlock?.text?.text).toContain(
        'Damage: 12 (core 12 + weapon 3, mit 20%) -> Wild Boar HP 0 KO',
      );

      const actionElements = payload.blocks
        .filter((block) => block.type === 'actions')
        .flatMap((block) => (block as ActionsBlock).elements ?? []);
      expect(actionElements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action_id: COMBAT_ACTIONS.HIDE_LOG,
            text: expect.objectContaining({ text: 'Hide combat log' }),
          }),
          expect.objectContaining({
            action_id: RUN_ACTIONS.CONTINUE,
          }),
          expect.objectContaining({
            action_id: RUN_ACTIONS.FINISH,
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

      mockedGetCombatLog.mockResolvedValueOnce({ success: false });

      await actionHandlers[COMBAT_ACTIONS.SHOW_LOG]({
        ack,
        body: {
          channel: { id: 'C-COMBAT' },
          actions: [{ value: 'combat-missing' }],
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
          actions: [{ value: 'combat-123' }],
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
                elements: [
                  {
                    type: 'button',
                    action_id: RUN_ACTIONS.CONTINUE,
                    text: { type: 'plain_text', text: 'Continue' },
                  },
                  {
                    type: 'button',
                    action_id: COMBAT_ACTIONS.HIDE_LOG,
                    text: { type: 'plain_text', text: 'Hide combat log' },
                  },
                ],
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
      const actionElements = payload.blocks
        .filter((block) => block.type === 'actions')
        .flatMap((block) => (block as ActionsBlock).elements ?? []);
      expect(actionElements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action_id: COMBAT_ACTIONS.SHOW_LOG,
            text: expect.objectContaining({ text: 'View full combat log' }),
            value: 'combat-123',
          }),
          expect.objectContaining({
            action_id: RUN_ACTIONS.CONTINUE,
          }),
        ]),
      );
    });
  });
});
