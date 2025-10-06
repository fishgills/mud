jest.mock('../gql-client', () => {
  const dmSdk = {
    Attack: jest.fn(),
    GetPlayer: jest.fn(),
    GetLocationEntities: jest.fn(),
    CreatePlayer: jest.fn(),
    CompletePlayer: jest.fn(),
    DeletePlayer: jest.fn(),
    GetLookView: jest.fn(),
    MovePlayer: jest.fn(),
    RerollPlayerStats: jest.fn(),
  };
  return { dmSdk };
});

jest.mock('./mapUtils', () => ({
  sendPngMap: jest.fn().mockResolvedValue(true),
}));

import { TargetType, Direction } from '../generated/dm-graphql';
import { dmSdk } from '../gql-client';
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

const mockedDmSdk = dmSdk as unknown as {
  Attack: jest.Mock;
  GetPlayer: jest.Mock;
  GetLocationEntities: jest.Mock;
  CreatePlayer: jest.Mock;
  CompletePlayer: jest.Mock;
  DeletePlayer: jest.Mock;
  GetLookView: jest.Mock;
  MovePlayer: jest.Mock;
  RerollPlayerStats: jest.Mock;
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
  mockedDmSdk.GetPlayer.mockResolvedValue({
    getPlayer: {
      success: true,
      data: {
        id: '1',
        slackId: toClientId('U1'),
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
    },
  });
});

describe('attackHandler', () => {
  it('attacks a mentioned player and acknowledges via DM notice (notifications deliver summaries)', async () => {
    const say = makeSay();
    const client = makeClient();

    mockedDmSdk.Attack.mockResolvedValueOnce({
      attack: {
        success: true,
        message: 'ok',
        data: {
          message: 'combat summary',
          playerMessages: [
            { slackId: 'U1', message: 'attacker wins' },
            { slackId: 'U2', message: 'defender loses' },
          ],
        },
      },
    });

    await attackHandler({
      userId: 'U1',
      text: `${COMMANDS.ATTACK} <@U2>`,
      say,
      client: client as unknown as HandlerContext['client'],
    } as HandlerContext);

    expect(mockedDmSdk.Attack).toHaveBeenCalledWith({
      slackId: toClientId('U1'),
      input: {
        targetType: TargetType.Player,
        targetSlackId: 'U2',
        ignoreLocation: true,
      },
    });
    expect(say).toHaveBeenCalledWith({
      text: '⚔️ Combat initiated! Check your DMs for the results.',
    });
    // Defender notifications are handled by NotificationService; no direct DM here
    expect(client.chat.postMessage).not.toHaveBeenCalled();
  });

  it('asks for a mention when username lacks slack id', async () => {
    const say = makeSay();

    await attackHandler({
      userId: 'U1',
      text: `${COMMANDS.ATTACK} @someone`,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Please mention the user like "attack @username" so I can identify them.',
    });
    expect(mockedDmSdk.Attack).not.toHaveBeenCalled();
  });

  it('prevents attacking yourself via mention', async () => {
    const say = makeSay();

    await attackHandler({
      userId: 'U1',
      text: `${COMMANDS.ATTACK} <@U1>`,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: SELF_ATTACK_ERROR });
    expect(mockedDmSdk.Attack).not.toHaveBeenCalled();
  });

  it('prompts the user to choose a target when no mention is provided', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: { success: true, data: { name: 'Hero', x: 0, y: 0 } },
    });
    mockedDmSdk.GetLocationEntities.mockResolvedValueOnce({
      getPlayersAtLocation: [],
      getMonstersAtLocation: [
        { id: '42', name: 'Goblin' },
        { id: '43', name: 'Orc' },
      ],
    });

    await attackHandler({
      userId: 'U1',
      text: COMMANDS.ATTACK,
      say,
    } as HandlerContext);

    expect(mockedDmSdk.Attack).not.toHaveBeenCalled();
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
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: { success: true, data: { name: 'Hero', x: 0, y: 0 } },
    });
    mockedDmSdk.GetLocationEntities.mockResolvedValueOnce({
      getPlayersAtLocation: [
        { id: '1', slackId: 'U1', name: 'Hero' },
        { id: '2', slackId: 'slack:U2', name: 'Friend' },
      ],
      getMonstersAtLocation: [],
    });

    await attackHandler({
      userId: 'U1',
      text: COMMANDS.ATTACK,
      say,
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
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: { success: true, data: { name: 'Hero', x: 0, y: 0 } },
    });
    mockedDmSdk.GetLocationEntities.mockResolvedValueOnce({
      getPlayersAtLocation: [],
      getMonstersAtLocation: [],
    });

    await attackHandler({
      userId: 'U1',
      text: COMMANDS.ATTACK,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'No monsters or players here to attack!',
    });
  });

  it('reports failure messages from the API', async () => {
    const say = makeSay();
    mockedDmSdk.Attack.mockResolvedValueOnce({
      attack: { success: false, message: 'Out of range' },
    });

    await attackHandler({
      userId: 'U1',
      text: `${COMMANDS.ATTACK} <@U2>`,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Attack failed: Out of range' });
  });

  it('surfaces unexpected errors via user friendly message', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockRejectedValueOnce(new Error('boom'));

    await attackHandler({
      userId: 'U1',
      text: COMMANDS.ATTACK,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('createHandler', () => {
  it('prompts for a name when missing', async () => {
    const say = makeSay();

    await createHandler({
      userId: 'U1',
      text: COMMANDS.NEW,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Please provide a name for your character! Example: "new AwesomeDude"',
    });
    expect(mockedDmSdk.CreatePlayer).not.toHaveBeenCalled();
  });

  it('creates a character and shows stats', async () => {
    const say = makeSay();
    mockedDmSdk.CreatePlayer.mockResolvedValueOnce({
      createPlayer: {
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
      },
    });

    await createHandler({
      userId: 'U1',
      text: `${COMMANDS.NEW} Hero`,
      say,
    } as HandlerContext);

    expect(mockedDmSdk.CreatePlayer).toHaveBeenCalledWith({
      input: { slackId: toClientId('U1'), name: 'Hero' },
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
    mockedDmSdk.CreatePlayer.mockRejectedValueOnce({
      response: {
        errors: [
          {
            message: 'exists',
            extensions: { code: 'PLAYER_EXISTS' },
          },
        ],
      },
    });

    await createHandler({
      userId: 'U1',
      text: `${COMMANDS.NEW} Hero`,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'You already have a character!' });
  });

  it('falls back to user friendly messages for other errors', async () => {
    const say = makeSay();
    mockedDmSdk.CreatePlayer.mockRejectedValueOnce(
      new Error('Player with slackId U1 already exists'),
    );

    await createHandler({
      userId: 'U1',
      text: `${COMMANDS.NEW} Hero`,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Player already exists' });
  });
});

describe('completeHandler', () => {
  it('confirms completion on success', async () => {
    const say = makeSay();
    mockedDmSdk.CompletePlayer.mockResolvedValueOnce({
      updatePlayerStats: { success: true },
    });

    await completeHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: '✅ Character creation complete! You can now move and attack.',
    });
  });

  it('reports API failures', async () => {
    const say = makeSay();
    mockedDmSdk.CompletePlayer.mockResolvedValueOnce({
      updatePlayerStats: { success: false, message: 'nope' },
    });

    await completeHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Error: nope' });
  });

  it('handles unexpected errors', async () => {
    const say = makeSay();
    mockedDmSdk.CompletePlayer.mockRejectedValueOnce(new Error('boom'));

    await completeHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('deleteHandler', () => {
  it('asks players to create a character when none exists', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: { success: false, data: null },
    });

    await deleteHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: `You don't have a character to delete! Use "new CharacterName" to create one.`,
    });
  });

  it('rejects deletions after creation phase', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: {
        success: true,
        data: {
          name: 'Hero',
          hp: 10,
          level: 2,
          xp: 5,
        },
      },
    });

    await deleteHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'Cannot delete character after creation is complete!',
        ),
      }),
    );
  });

  it('deletes characters during creation phase', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: {
        success: true,
        data: {
          name: 'Hero',
          hp: 1,
          level: 1,
          xp: 0,
        },
      },
    });
    mockedDmSdk.DeletePlayer.mockResolvedValueOnce({
      deletePlayer: { success: true },
    });

    await deleteHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(mockedDmSdk.DeletePlayer).toHaveBeenCalledWith({
      slackId: toClientId('U1'),
    });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('has been successfully deleted'),
      }),
    );
  });

  it('reports failures when delete mutation fails', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: {
        success: true,
        data: {
          name: 'Hero',
          hp: 1,
          level: 1,
          xp: 0,
        },
      },
    });
    mockedDmSdk.DeletePlayer.mockResolvedValueOnce({
      deletePlayer: { success: false, message: 'nope' },
    });

    await deleteHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Failed to delete character: nope',
    });
  });

  it('handles unexpected delete errors', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: {
        success: true,
        data: {
          name: 'Hero',
          hp: 1,
          level: 1,
          xp: 0,
        },
      },
    });
    mockedDmSdk.DeletePlayer.mockRejectedValueOnce(new Error('boom'));

    await deleteHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('lookHandler', () => {
  it('renders the look view with monsters and perf stats', async () => {
    const say = makeSay();
    mockedDmSdk.GetLocationEntities.mockResolvedValueOnce({
      getPlayersAtLocation: [
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
      getMonstersAtLocation: [{ name: 'Goblin' }, { name: 'Orc' }],
    });
    mockedDmSdk.GetLookView.mockResolvedValueOnce({
      getLookView: {
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
      },
    });

    await lookHandler({ userId: 'U1', text: '', say } as HandlerContext);

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
    mockedDmSdk.GetLocationEntities.mockResolvedValueOnce({
      getPlayersAtLocation: [
        {
          id: '1',
          slackId: toClientId('U1'),
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
      getMonstersAtLocation: [],
    });
    mockedDmSdk.GetLookView.mockResolvedValueOnce({
      getLookView: {
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
      },
    });

    await lookHandler({ userId: 'U1', text: '', say } as HandlerContext);

    // Should not post an occupants summary when only self is present
    expect(say).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('You see at your location:'),
      }),
    );
  });

  it('reports look failures from the API', async () => {
    const say = makeSay();
    mockedDmSdk.GetLookView.mockResolvedValueOnce({
      getLookView: {
        success: false,
        message: 'permission denied',
      },
    });

    await lookHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Failed to look: permission denied',
    });
  });

  it('handles unexpected look errors', async () => {
    const say = makeSay();
    mockedDmSdk.GetLookView.mockRejectedValueOnce(new Error('boom'));

    await lookHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('mapHandler', () => {
  it('requests a PNG map for the current location', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: {
        success: true,
        data: { x: 3, y: -4 },
      },
    });

    await mapHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(mockedSendPngMap).toHaveBeenCalledWith(say, 3, -4, 8);
  });

  it('displays co-located players after the map', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: {
        success: true,
        data: { x: 3, y: -4 },
      },
    });
    mockedDmSdk.GetLocationEntities.mockResolvedValueOnce({
      getPlayersAtLocation: [
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
      getMonstersAtLocation: [],
    });

    await mapHandler({ userId: 'U1', text: '', say } as HandlerContext);

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
    mockedDmSdk.GetPlayer.mockResolvedValueOnce({
      getPlayer: { success: true, data: { x: 5, y: 6 } },
    });
    mockedDmSdk.GetLocationEntities.mockResolvedValueOnce({
      getPlayersAtLocation: [
        {
          id: '1',
          slackId: toClientId('U1'),
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
      getMonstersAtLocation: [],
    });

    await mapHandler({ userId: 'U1', text: '', say } as HandlerContext);

    // No occupants summary should be posted when only self is present
    expect(say).not.toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('You see at your location:'),
      }),
    );
  });

  it('announces map failures', async () => {
    const say = makeSay();
    mockedDmSdk.GetPlayer.mockRejectedValueOnce(new Error('fail'));

    await mapHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Failed to load map: Error: fail',
    });
  });
});

describe('moveHandler', () => {
  it('validates direction input', async () => {
    const say = makeSay();

    await moveHandler({
      userId: 'U1',
      text: 'stand still',
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: 'Please use a direction: up, down, left, right, north, south, east, or west.',
    });
  });

  it('moves in a cardinal direction and reports surroundings', async () => {
    const say = makeSay();
    mockedDmSdk.MovePlayer.mockResolvedValueOnce({
      movePlayer: {
        success: true,
        player: { x: 1, y: 2 },
        monsters: [{ name: 'Goblin' }],
        playersAtLocation: [{ name: 'Friend' }],
      },
    });

    await moveHandler({
      userId: 'U1',
      text: COMMANDS.NORTH,
      say,
    } as HandlerContext);

    expect(mockedDmSdk.MovePlayer).toHaveBeenCalledWith({
      slackId: toClientId('U1'),
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

  it('moves directly to coordinates', async () => {
    const say = makeSay();
    mockedDmSdk.MovePlayer.mockResolvedValueOnce({
      movePlayer: {
        success: true,
        player: { x: 10, y: -5 },
        monsters: [],
        playersAtLocation: [],
      },
    });

    await moveHandler({
      userId: 'U1',
      text: 'move 10 -5',
      say,
    } as HandlerContext);

    expect(mockedDmSdk.MovePlayer).toHaveBeenCalledWith({
      slackId: toClientId('U1'),
      input: { x: 10, y: -5 },
    });
    expect(say).toHaveBeenCalledWith({
      text: 'You moved directly to (10, -5).',
    });
  });

  it('reports move failures', async () => {
    const say = makeSay();
    mockedDmSdk.MovePlayer.mockResolvedValueOnce({
      movePlayer: { success: false, message: 'blocked' },
    });

    await moveHandler({
      userId: 'U1',
      text: COMMANDS.NORTH,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Move failed: blocked' });
  });

  it('handles unexpected move errors', async () => {
    const say = makeSay();
    mockedDmSdk.MovePlayer.mockRejectedValueOnce(new Error('boom'));

    await moveHandler({
      userId: 'U1',
      text: COMMANDS.NORTH,
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});

describe('rerollHandler', () => {
  it('announces new stats on success', async () => {
    const say = makeSay();
    mockedDmSdk.RerollPlayerStats.mockResolvedValueOnce({
      rerollPlayerStats: {
        success: true,
        data: {
          strength: 8,
          agility: 7,
          health: 6,
          maxHp: 12,
        },
      },
    });

    await rerollHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({
      text: '🎲 Rerolled stats: Strength: 8, Agility: 7, Vitality: 6, Health Points: 12',
    });
  });

  it('relays failure responses', async () => {
    const say = makeSay();
    mockedDmSdk.RerollPlayerStats.mockResolvedValueOnce({
      rerollPlayerStats: { success: false, message: 'cooldown' },
    });

    await rerollHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'Error: cooldown' });
  });

  it('handles reroll errors', async () => {
    const say = makeSay();
    mockedDmSdk.RerollPlayerStats.mockRejectedValueOnce(new Error('boom'));

    await rerollHandler({ userId: 'U1', text: '', say } as HandlerContext);

    expect(say).toHaveBeenCalledWith({ text: 'boom' });
  });
});
