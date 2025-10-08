jest.mock('../gql-client', () => {
  const dmSdk = {
    GetPlayerWithLocation: jest.fn(),
    GetLocationEntities: jest.fn(),
  };
  return { dmSdk };
});

import { dmSdk } from '../gql-client';
import { sniffHandler } from './sniff';
import { HandlerContext } from './types';
import { toClientId } from '../utils/clientId';

const mockedDmSdk = dmSdk as unknown as {
  GetPlayerWithLocation: jest.Mock;
  GetLocationEntities: jest.Mock;
};

const makeSay = () =>
  jest
    .fn<Promise<void>, [Parameters<HandlerContext['say']>[0]]>()
    .mockResolvedValue(undefined);

describe('sniffHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports the nearest monster within the ability-based range', async () => {
    mockedDmSdk.GetPlayerWithLocation.mockResolvedValue({
      getPlayer: {
        success: true,
        data: {
          id: '1',
          slackId: toClientId('U1'),
          name: 'Hero',
          x: 0,
          y: 0,
          hp: 10,
          maxHp: 10,
          strength: 10,
          agility: 6,
          health: 10,
          gold: 0,
          xp: 0,
          level: 1,
          skillPoints: 0,
          isAlive: true,
          nearbyMonsters: [],
        },
      },
    });

    mockedDmSdk.GetLocationEntities.mockImplementation(async ({ x, y }) => ({
      getPlayersAtLocation: [],
      getMonstersAtLocation:
        x === 1 && y === 1
          ? [
              {
                __typename: 'Monster',
                id: 'm1',
                name: 'Goblin',
                type: 'Goblin',
                hp: 8,
                maxHp: 8,
                strength: 6,
                agility: 6,
                health: 6,
                x,
                y,
                isAlive: true,
              },
            ]
          : [],
    }));

    const say = makeSay();

    await sniffHandler({
      userId: 'U1',
      text: 'sniff',
      say,
    } as HandlerContext);

    expect(mockedDmSdk.GetPlayerWithLocation).toHaveBeenCalledWith({
      slackId: toClientId('U1'),
    });

    expect(say).toHaveBeenCalledTimes(1);
    const message = say.mock.calls[0][0] as { text: string };
    expect(message.text).toContain('Goblin');
    expect(message.text).toContain('Ability 6');
    expect(message.text).toContain('range 3');
    expect(message.text).toContain('2 tiles');
    expect(message.text).toContain('north-east');

    const entityCalls = mockedDmSdk.GetLocationEntities.mock.calls;
    expect(entityCalls.length).toBeGreaterThan(0);
    for (const [variables] of entityCalls) {
      const { x, y } = variables as { x: number; y: number };
      const distance = Math.abs(x) + Math.abs(y);
      expect(distance).toBeLessThanOrEqual(3);
    }
  });

  it('informs the player when no monsters are within range', async () => {
    mockedDmSdk.GetPlayerWithLocation.mockResolvedValue({
      getPlayer: {
        success: true,
        data: {
          id: '1',
          slackId: toClientId('U1'),
          name: 'Hero',
          x: 0,
          y: 0,
          hp: 10,
          maxHp: 10,
          strength: 10,
          agility: 4,
          health: 10,
          gold: 0,
          xp: 0,
          level: 1,
          skillPoints: 0,
          isAlive: true,
          nearbyMonsters: [],
        },
      },
    });

    mockedDmSdk.GetLocationEntities.mockImplementation(async () => ({
      getPlayersAtLocation: [],
      getMonstersAtLocation: [],
    }));

    const say = makeSay();

    await sniffHandler({
      userId: 'U1',
      text: 'sniff',
      say,
    } as HandlerContext);

    expect(say).toHaveBeenCalledTimes(1);
    const message = say.mock.calls[0][0] as { text: string };
    expect(message.text).toContain('No monsters are within range');
    expect(message.text).toContain('Ability 4');
    expect(message.text).toContain('range 2');

    for (const [variables] of mockedDmSdk.GetLocationEntities.mock.calls) {
      const { x, y } = variables as { x: number; y: number };
      const distance = Math.abs(x) + Math.abs(y);
      expect(distance).toBeLessThanOrEqual(2);
    }
  });

  it('surfaces the service error when the character is missing', async () => {
    mockedDmSdk.GetPlayerWithLocation.mockResolvedValue({
      getPlayer: {
        success: false,
        message: 'Player not found',
      },
    });

    const say = makeSay();

    await sniffHandler({
      userId: 'U1',
      text: 'sniff',
      say,
    } as HandlerContext);

    expect(mockedDmSdk.GetLocationEntities).not.toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith({ text: 'Player not found' });
  });
});
