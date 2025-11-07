jest.mock('../dm-client', () => {
  const dmClient = {
    attack: jest.fn(),
    getPlayer: jest.fn(),
    getLocationEntities: jest.fn(),
    createPlayer: jest.fn(),
    completePlayer: jest.fn(),
    deletePlayer: jest.fn(),
    getLookView: jest.fn(),
    movePlayer: jest.fn(),
    rerollPlayerStats: jest.fn(),
  };
  return { dmClient };
});

jest.mock('./mapUtils', () => ({
  sendPngMap: jest.fn().mockResolvedValue(true),
}));

import { TargetType, Direction, AttackOrigin } from '../dm-types';
import { dmClient } from '../dm-client';
import { sendPngMap } from './mapUtils';
import { attackHandler, SELF_ATTACK_ERROR } from './attack';
import { createHandler } from './create';
import { completeHandler } from './complete';
import { deleteHandler } from './delete';
import { lookHandler } from './look';
import { mapHandler } from './map';
import { moveHandler } from './move';
import { rerollHandler } from './reroll';
import { COMMANDS, ATTACK_ACTIONS } from '../commands';
import type { HandlerContext, SayMessage } from './types';
import { toClientId } from '../utils/clientId';

const mockedDmClient = dmClient as unknown as {
  attack: jest.Mock;
  getPlayer: jest.Mock;
  getLocationEntities: jest.Mock;
  createPlayer: jest.Mock;
  completePlayer: jest.Mock;
  deletePlayer: jest.Mock;
  getLookView: jest.Mock;
  movePlayer: jest.Mock;
  rerollPlayerStats: jest.Mock;
};

const mockedSendPngMap = sendPngMap as unknown as jest.MockedFunction<
  typeof sendPngMap
>;

type MockSlackClient = {
  conversations: {
    open: jest.Mock<Promise<{ channel: { id: string } }>, [{ users: string }]>;
  };
  chat: {
    postMessage: jest.Mock<Promise<void>, [Record<string, unknown>]>;
    update: jest.Mock<Promise<void>, [Record<string, unknown>]>;
  };
};

const makeSay = () =>
  jest.fn<Promise<void>, [SayMessage]>().mockResolvedValue(undefined);

const makeClient = (channelId = 'D1'): MockSlackClient => ({
  conversations: {
    open: jest
      .fn<Promise<{ channel: { id: string } }>, [{ users: string }]>()
      .mockResolvedValue({
        channel: { id: channelId },
      }),
  },
  chat: {
    postMessage: jest
      .fn<Promise<void>, [Record<string, unknown>]>()
      .mockResolvedValue(undefined),
    update: jest
      .fn<Promise<void>, [Record<string, unknown>]>()
      .mockResolvedValue(undefined),
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedDmClient.getPlayer.mockResolvedValue({
    success: true,
    data: {
      id: '1',
      slackId: toClientId('U1', 'T1'),
      name: 'Hero',
      hp: 1,
      maxHp: 10,
      level: 1,
      xp: 0,
      skillPoints: 0,
      x: 0,
      y: 0,
      nearbyMonsters: [],
    },
  });
});

describe('attackHandler', () => {
  it('attacks a mentioned player and acknowledges via DM notice (notifications deliver summaries)', async () => {
    const say = makeSay();
    const client = makeClient();

    mockedDmClient.attack.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      data: {
        message: 'combat summary',
        playerMessages: [
          { slackId: 'U1', message: 'attacker wins' },
          { slackId: 'U2', message: 'defender loses' },
        ],
      },
    });

    await attackHandler.handle({
      userId: 'U1',
      text: `${COMMANDS.ATTACK} <@U2>`,
      say,
      client: client as unknown as HandlerContext['client'],
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.attack).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
      input: {
        targetType: TargetType.Player,
        targetSlackId: 'U2',
        ignoreLocation: true,
        attackOrigin: AttackOrigin.TextPvp,
      },
    });
    // No local initiation message; combat resolution sent via event bus notifications
    expect(say).not.toHaveBeenCalled();
    // Combat messages are now delivered via the notification service (Redis), not directly via client
    expect(client.conversations.open).not.toHaveBeenCalled();
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it('asks for a mention when username lacks slack id', async () => {
    const say = makeSay();

    await attackHandler.handle({
      userId: 'U1',
      text: `${COMMANDS.ATTACK} @someone`,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Please mention the user like "attack @username" so I can identify them.',
    });
    expect(mockedDmClient.attack).not.toHaveBeenCalled();
  });

  it('prevents attacking yourself via mention', async () => {
    const say = makeSay();

    await attackHandler.handle({
      userId: 'U1',
      text: `${COMMANDS.ATTACK} <@U1>`,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: SELF_ATTACK_ERROR });
    expect(mockedDmClient.attack).not.toHaveBeenCalled();
  });

  it('prompts the user to choose a target when no mention is provided', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { name: 'Hero', x: 0, y: 0 },
    });
    mockedDmClient.getLocationEntities.mockResolvedValueOnce({
      players: [],
      monsters: [
        { id: '42', name: 'Goblin' },
        { id: '43', name: 'Orc' },
      ],
    });

    await attackHandler.handle({
      userId: 'U1',
      text: COMMANDS.ATTACK,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.attack).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledTimes(1);
    const message = say.mock.calls[0][0] as {
      text?: string;
      blocks?: Array<{
        type: string;
        elements?: Array<Record<string, unknown>>;
      }>;
    };
    expect(message.text).toContain('Choose a target to attack');
    const actionsBlock = message.blocks?.find(
      (block) => block.type === 'actions',
    );
    expect(actionsBlock?.elements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'static_select',
          action_id: ATTACK_ACTIONS.MONSTER_SELECT,
        }),
        expect.objectContaining({
          type: 'button',
          action_id: ATTACK_ACTIONS.ATTACK_MONSTER,
        }),
      ]),
    );
  });

  it('excludes the invoking player from target options', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { name: 'Hero', x: 0, y: 0 },
    });
    mockedDmClient.getLocationEntities.mockResolvedValueOnce({
      players: [
        { id: '1', slackId: 'U1', name: 'Hero' },
        { id: '2', slackId: 'slack:U2', name: 'Friend' },
      ],
      monsters: [],
    });

    await attackHandler.handle({
      userId: 'U1',
      text: COMMANDS.ATTACK,
      say,
      teamId: 'T1',
    } as HandlerContext);

    const message = say.mock.calls[0][0] as {
      blocks?: Array<{
        type: string;
        elements?: Array<Record<string, unknown>>;
      }>;
    };
    const actionsBlock = message.blocks?.find(
      (block) => block.type === 'actions',
    );
    const select = actionsBlock?.elements?.find(
      (element) => element.type === 'static_select',
    ) as { options?: Array<{ value?: string }> } | undefined;
    const optionValues = select?.options?.map((option) => option.value);

    expect(optionValues).toContain('P:U2');
    expect(optionValues).not.toContain('P:U1');
  });

  it('informs the user when no monsters or players are nearby', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { name: 'Hero', x: 0, y: 0 },
    });
    mockedDmClient.getLocationEntities.mockResolvedValueOnce({
      players: [],
      monsters: [],
    });

    await attackHandler.handle({
      userId: 'U1',
      text: COMMANDS.ATTACK,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'No monsters or players here to attack!',
    });
  });

  it('reports failure messages from the API', async () => {
    const say = makeSay();
    mockedDmClient.attack.mockResolvedValueOnce({
      success: false,
      message: 'Out of range',
    });

    await attackHandler.handle({
      userId: 'U1',
      text: `${COMMANDS.ATTACK} <@U2>`,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Attack failed: Out of range' });
  });

  it('surfaces unexpected errors via user friendly message', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockRejectedValueOnce(new Error('boom'));

    await attackHandler.handle({
      userId: 'U1',
      text: COMMANDS.ATTACK,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('createHandler', () => {
  it('prompts for a name when missing', async () => {
    const say = makeSay();

    await createHandler.handle({
      userId: 'U1',
      text: COMMANDS.NEW,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Please provide a name for your character! Example: "new AwesomeDude"',
    });
    expect(mockedDmClient.createPlayer).not.toHaveBeenCalled();
  });

  it('creates a character and shows stats', async () => {
    const say = makeSay();
    mockedDmClient.createPlayer.mockResolvedValueOnce({
      success: true,
      data: {
        name: 'Hero',
        strength: 8,
        agility: 7,
        health: 6,
        hp: 6,
        maxHp: 6,
        gold: 0,
        xp: 0,
        level: 1,
        skillPoints: 0,
        x: 0,
        y: 0,
      },
    });

    await createHandler.handle({
      userId: 'U1',
      text: `${COMMANDS.NEW} Hero`,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.createPlayer).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
      name: 'Hero',
    });
    expect(say).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Welcome <@U1>!'),
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'section',
            text: expect.objectContaining({
              text: expect.stringContaining('Welcome <@U1>!'),
            }),
          }),
        ]),
      }),
    );
  });

  it('handles existing player errors explicitly', async () => {
    const say = makeSay();
    mockedDmClient.createPlayer.mockRejectedValueOnce(
      new Error('Player already exists'),
    );

    await createHandler.handle({
      userId: 'U1',
      text: `${COMMANDS.NEW} Hero`,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'You already have a character!' });
  });

  it('falls back to user friendly messages for other errors', async () => {
    const say = makeSay();
    mockedDmClient.createPlayer.mockRejectedValueOnce(
      new Error('Boom! Something bad happened'),
    );

    await createHandler.handle({
      userId: 'U1',
      text: `${COMMANDS.NEW} Hero`,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Boom! Something bad happened',
    });
  });
});

describe('completeHandler', () => {
  it('confirms completion on success', async () => {
    const say = makeSay();
    mockedDmClient.completePlayer.mockResolvedValueOnce({ success: true });

    await completeHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: '✅ Character creation complete! You can now move and attack.',
    });
  });

  it('reports API failures', async () => {
    const say = makeSay();
    mockedDmClient.completePlayer.mockResolvedValueOnce({
      success: false,
      message: 'nope',
    });

    await completeHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Error: nope' });
  });

  it('handles unexpected errors', async () => {
    const say = makeSay();
    mockedDmClient.completePlayer.mockRejectedValueOnce(new Error('boom'));

    await completeHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('deleteHandler', () => {
  it('asks players to create a character when none exists', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: false,
      data: null,
    });

    await deleteHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: `You don't have a character to delete! Use "new CharacterName" to create one.`,
    });
  });

  it('deletes characters even when fully active', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: {
        name: 'Hero',
        hp: 25,
        level: 7,
        xp: 420,
      },
    });
    mockedDmClient.deletePlayer.mockResolvedValueOnce({ success: true });

    await deleteHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.deletePlayer).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
    });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('vanishes into legend'),
      }),
    );
  });

  it('reports failures when delete mutation fails', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: {
        name: 'Hero',
        hp: 10,
        level: 3,
        xp: 12,
      },
    });
    mockedDmClient.deletePlayer.mockResolvedValueOnce({
      success: false,
      message: 'nope',
    });

    await deleteHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Failed to delete character: nope',
    });
  });

  it('handles unexpected delete errors', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: {
        name: 'Hero',
        hp: 1,
        level: 1,
        xp: 0,
      },
    });
    mockedDmClient.deletePlayer.mockRejectedValueOnce(new Error('boom'));

    await deleteHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('lookHandler', () => {
  it('renders the look view with monsters and perf stats', async () => {
    const say = makeSay();
    mockedDmClient.getLocationEntities.mockResolvedValueOnce({
      players: [
        {
          id: '2',
          slackId: toClientId('U2'),
          name: 'Friend',
          x: 0,
          y: 0,
          hp: 10,
          maxHp: 10,
          strength: 1,
          agility: 1,
          health: 1,
          gold: 0,
          xp: 0,
          level: 1,
          skillPoints: 0,
          isAlive: true,
        },
        {
          id: '1',
          slackId: 'U1',
          name: 'Hero',
          x: 0,
          y: 0,
          hp: 10,
          maxHp: 10,
          strength: 1,
          agility: 1,
          health: 1,
          gold: 0,
          xp: 0,
          level: 1,
          skillPoints: 0,
          isAlive: true,
        },
      ],
      monsters: [{ name: 'Goblin' }, { name: 'Orc' }],
    });
    mockedDmClient.getLookView.mockResolvedValueOnce({
      success: true,
      data: {
        description: 'A vast plain',
        location: {
          x: 0,
          y: 0,
          biomeName: 'plains',
          description: '',
          height: 0.5,
          temperature: 0.5,
          moisture: 0.5,
        },
        monsters: [{ name: 'Goblin' }, { name: 'Orc' }],
      },
      perf: {
        totalMs: 50,
        playerMs: 5,
        worldCenterNearbyMs: 10,
        worldBoundsTilesMs: 4,
        worldExtendedBoundsMs: 6,
        tilesFilterMs: 3,
        peaksSortMs: 2,
        biomeSummaryMs: 8,
        settlementsFilterMs: 5,
        aiMs: 7,
        aiProvider: 'mock',
      },
    });

    await lookHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenNthCalledWith(1, { text: 'A vast plain' });
    // Unified occupant summary (players + monsters at location)
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('You see at your location:'),
      }),
    );
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Players: Friend'),
      }),
    );
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Monsters: Goblin, Orc'),
      }),
    );
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Perf: total 50ms'),
      }),
    );
  });

  it('does not list the current player in co-located players', async () => {
    const say = makeSay();
    // Only returns the invoking player at this location
    mockedDmClient.getLocationEntities.mockResolvedValueOnce({
      players: [
        {
          id: '1',
          slackId: toClientId('U1', 'T1'),
          name: 'Hero',
          x: 0,
          y: 0,
          hp: 10,
          maxHp: 10,
          strength: 1,
          agility: 1,
          health: 1,
          gold: 0,
          xp: 0,
          level: 1,
          skillPoints: 0,
          isAlive: true,
        },
      ],
      monsters: [],
    });
    mockedDmClient.getLookView.mockResolvedValueOnce({
      success: true,
      data: {
        description: 'Scenery',
        location: {
          x: 0,
          y: 0,
          biomeName: 'plains',
          description: '',
          height: 0.5,
          temperature: 0.5,
          moisture: 0.5,
        },
        monsters: [],
      },
    });

    await lookHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    // Should not post an occupants summary when only self is present
    expect(say).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('You see at your location:'),
      }),
    );
  });

  it('reports look failures from the API', async () => {
    const say = makeSay();
    mockedDmClient.getLookView.mockResolvedValueOnce({
      success: false,
      message: 'permission denied',
    });

    await lookHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Failed to look: permission denied',
    });
  });

  it('handles unexpected look errors', async () => {
    const say = makeSay();
    mockedDmClient.getLookView.mockRejectedValueOnce(new Error('boom'));

    await lookHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('mapHandler', () => {
  it('requests a PNG map for the current location', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { x: 3, y: -4 },
    });

    await mapHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedSendPngMap).toHaveBeenCalledWith(say, 3, -4, 8);
  });

  it('displays co-located players after the map', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { x: 3, y: -4 },
    });
    mockedDmClient.getLocationEntities.mockResolvedValueOnce({
      players: [
        {
          id: '2',
          slackId: toClientId('U2'),
          name: 'Friend',
          x: 3,
          y: -4,
          hp: 10,
          maxHp: 10,
          strength: 1,
          agility: 1,
          health: 1,
          gold: 0,
          xp: 0,
          level: 1,
          skillPoints: 0,
          isAlive: true,
        },
      ],
      monsters: [],
    });

    await mapHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('You see at your location:'),
      }),
    );
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Players: Friend'),
      }),
    );
  });

  it('does not list the current player after the map', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockResolvedValueOnce({
      success: true,
      data: { x: 5, y: 6 },
    });
    mockedDmClient.getLocationEntities.mockResolvedValueOnce({
      players: [
        {
          id: '1',
          slackId: toClientId('U1', 'T1'),
          name: 'Hero',
          x: 5,
          y: 6,
          hp: 10,
          maxHp: 10,
          strength: 1,
          agility: 1,
          health: 1,
          gold: 0,
          xp: 0,
          level: 1,
          skillPoints: 0,
          isAlive: true,
        },
      ],
      monsters: [],
    });

    await mapHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    // No occupants summary should be posted when only self is present
    expect(say).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('You see at your location:'),
      }),
    );
  });

  it('announces map failures', async () => {
    const say = makeSay();
    mockedDmClient.getPlayer.mockRejectedValueOnce(new Error('fail'));

    await mapHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Failed to load map: fail',
    });
  });
});

describe('moveHandler', () => {
  it('validates direction input', async () => {
    const say = makeSay();

    await moveHandler.handle({
      userId: 'U1',
      text: 'stand still',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Please use a direction: up, down, left, right, north, south, east, or west.',
    });
  });

  it('moves in a cardinal direction and reports surroundings', async () => {
    const say = makeSay();
    mockedDmClient.movePlayer.mockResolvedValueOnce({
      success: true,
      player: { x: 1, y: 2 },
      monsters: [{ name: 'Goblin' }],
      playersAtLocation: [{ name: 'Friend' }],
    });

    await moveHandler.handle({
      userId: 'U1',
      text: COMMANDS.NORTH,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.movePlayer).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
      input: { direction: Direction.North },
    });
    expect(mockedSendPngMap).toHaveBeenCalledWith(say, 1, 2, 8);
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('You see at your location:'),
      }),
    );
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Players: Friend'),
      }),
    );
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Monsters: Goblin'),
      }),
    );
    expect(say).toHaveBeenCalledWith({
      text: 'You moved north. You are now at (1, 2).',
    });
  });

  it('moves multiple spaces when requested and reports the distance', async () => {
    const say = makeSay();
    mockedDmClient.movePlayer.mockResolvedValueOnce({
      success: true,
      player: { x: 4, y: 2 },
      monsters: [],
      playersAtLocation: [],
    });

    await moveHandler.handle({
      userId: 'U1',
      text: 'move north 3',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.movePlayer).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
      input: { direction: Direction.North, distance: 3 },
    });
    expect(say).toHaveBeenCalledWith({
      text: 'You moved north 3 spaces. You are now at (4, 2).',
    });
  });

  it('moves directly to coordinates', async () => {
    const say = makeSay();
    mockedDmClient.movePlayer.mockResolvedValueOnce({
      success: true,
      player: { x: 10, y: -5 },
      monsters: [],
      playersAtLocation: [],
    });

    await moveHandler.handle({
      userId: 'U1',
      text: 'move 10 -5',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.movePlayer).toHaveBeenCalledWith({
      slackId: toClientId('U1', 'T1'),
      input: { x: 10, y: -5 },
    });
    expect(say).toHaveBeenCalledWith({
      text: 'You moved directly to (10, -5).',
    });
  });

  it('reports move failures', async () => {
    const say = makeSay();
    mockedDmClient.movePlayer.mockResolvedValueOnce({
      success: false,
      message: 'blocked',
    });

    await moveHandler.handle({
      userId: 'U1',
      text: COMMANDS.NORTH,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Move failed: blocked' });
  });

  it('handles unexpected move errors', async () => {
    const say = makeSay();
    mockedDmClient.movePlayer.mockRejectedValueOnce(new Error('boom'));

    await moveHandler.handle({
      userId: 'U1',
      text: COMMANDS.NORTH,
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('rerollHandler', () => {
  it('announces new stats on success', async () => {
    const say = makeSay();
    mockedDmClient.rerollPlayerStats.mockResolvedValueOnce({
      success: true,
      data: {
        strength: 8,
        agility: 7,
        health: 6,
        maxHp: 12,
      },
    });

    await rerollHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: '🎲 Rerolled stats: Strength: 8, Agility: 7, Vitality: 6, Health Points: 12',
    });
  });

  it('relays failure responses', async () => {
    const say = makeSay();
    mockedDmClient.rerollPlayerStats.mockResolvedValueOnce({
      success: false,
      message: 'cooldown',
    });

    await rerollHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Error: cooldown' });
  });

  it('handles reroll errors', async () => {
    const say = makeSay();
    mockedDmClient.rerollPlayerStats.mockRejectedValueOnce(new Error('boom'));

    await rerollHandler.handle({
      userId: 'U1',
      text: '',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});
