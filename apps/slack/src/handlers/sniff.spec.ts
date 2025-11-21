jest.mock('../dm-client', () => ({
  sniffNearestMonster: jest.fn(),
}));

import type { HandlerContext } from './types';
import { sniffHandler, __private__ } from './sniff';
import { sniffNearestMonster } from '../dm-client';

const mockedSniffNearestMonster =
  sniffNearestMonster as unknown as jest.MockedFunction<
    typeof sniffNearestMonster
  >;

describe('sniff handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders monster details when DM returns a target', async () => {
    mockedSniffNearestMonster.mockResolvedValue({
      success: true,
      data: {
        detectionRadius: 4,
        monsterName: 'Goblin',
        distanceLabel: 'nearby',
        direction: 'north',
        playerDetectionRadius: 8,
      },
      message: 'You catch the scent of Goblin nearby to the north.',
    });

    const say = jest
      .fn<Promise<void>, Parameters<HandlerContext['say']>>()
      .mockResolvedValue();

    await sniffHandler({
      userId: 'U123',
      teamId: 'T1',
      say,
    } as unknown as HandlerContext);

    expect(mockedSniffNearestMonster).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U123',
    });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'You catch the scent of Goblin nearby to the north.',
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'header' }),
          expect.objectContaining({ type: 'section' }),
        ]),
      }),
    );
  });

  it('falls back to a default sniff message when no monster is found', async () => {
    mockedSniffNearestMonster.mockResolvedValue({
      success: true,
      data: {
        detectionRadius: 2,
        playerDetectionRadius: 4,
      },
    });

    const say = jest
      .fn<Promise<void>, Parameters<HandlerContext['say']>>()
      .mockResolvedValue();

    await sniffHandler({
      userId: 'U999',
      teamId: 'T9',
      say,
    } as unknown as HandlerContext);

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "You sniff the air but can't catch any monster scent within 2 tiles or any players within 4 tiles.",
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'header' }),
          expect.objectContaining({ type: 'section' }),
        ]),
      }),
    );
  });

  it('includes player details when returned by DM', async () => {
    mockedSniffNearestMonster.mockResolvedValue({
      success: true,
      data: {
        detectionRadius: 3,
        playerDetectionRadius: 6,
        playerName: 'Rival',
        playerDistanceLabel: 'very close',
        playerDirection: 'west',
      },
    });

    const say = jest
      .fn<Promise<void>, Parameters<HandlerContext['say']>>()
      .mockResolvedValue();

    await sniffHandler({
      userId: 'U777',
      teamId: 'T7',
      say,
    } as unknown as HandlerContext);

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Rival'),
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'section' }),
        ]),
      }),
    );
  });

  it('reports DM service errors to the user', async () => {
    mockedSniffNearestMonster.mockResolvedValue({
      success: false,
      message: 'Service unavailable',
    });

    const say = jest
      .fn<Promise<void>, Parameters<HandlerContext['say']>>()
      .mockResolvedValue();

    await sniffHandler({
      userId: 'U000',
      teamId: 'T0',
      say,
    } as unknown as HandlerContext);

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Service unavailable' }),
    );
  });
});

describe('sniff private helpers', () => {
  const {
    resolveDistanceLabel,
    arrowForDirection,
    buildMonsterBlockText,
    buildPlayerBlockText,
  } = __private__;

  it('returns readable distance labels', () => {
    expect(resolveDistanceLabel('nearby', 'near')).toBe('nearby');
    expect(resolveDistanceLabel(undefined, 'far')).toBe('a ways off');
    expect(resolveDistanceLabel(undefined, undefined)).toBe('somewhere nearby');
  });

  it('maps directions to emoji arrows', () => {
    expect(arrowForDirection('north')).toBe(':arrow_up:');
    expect(arrowForDirection('west')).toBe(':arrow_left:');
    expect(arrowForDirection('here')).toBe(':round_pushpin:');
    expect(arrowForDirection(undefined)).toBe(':compass:');
  });

  it('builds monster block markdown when data is complete', () => {
    expect(
      buildMonsterBlockText({
        monsterName: 'Goblin',
        distanceLabel: 'nearby',
        direction: 'north',
        proximity: 'near',
      }),
    ).toContain('*Monster* • Goblin');
    expect(buildMonsterBlockText({})).toBeUndefined();
  });

  it('builds player block markdown when data is complete', () => {
    expect(
      buildPlayerBlockText({
        playerName: 'Rival',
        playerDistanceLabel: 'very close',
        playerDirection: 'east',
        playerProximity: 'close',
      }),
    ).toContain('*Player* • Rival');
    expect(buildPlayerBlockText({})).toBeUndefined();
  });
});
