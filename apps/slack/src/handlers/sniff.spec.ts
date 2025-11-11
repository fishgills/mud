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

  it('appends settlement details when the DM message omits them', async () => {
    mockedSniffNearestMonster.mockResolvedValue({
      success: true,
      data: {
        detectionRadius: 4,
        monsterName: 'Goblin',
        distanceLabel: 'nearby',
        direction: 'north',
        nearestSettlementName: 'Fooville',
        nearestSettlementDirection: 'west',
        nearestSettlementDistance: 7,
        nearestSettlementDistanceLabel: 'nearby',
        nearestSettlementProximity: 'near',
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
        text: 'You catch the scent of Goblin nearby to the north. The nearest settlement is Fooville nearby to the west.',
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'header' }),
          expect.objectContaining({ type: 'section' }),
        ]),
      }),
    );
  });

  it('does not duplicate settlement details already present in the message', async () => {
    const messageWithSettlement =
      'You catch the scent of Goblin nearby to the north. The nearest settlement is Fooville nearby to the west.';

    mockedSniffNearestMonster.mockResolvedValue({
      success: true,
      data: {
        detectionRadius: 4,
        monsterName: 'Goblin',
        distanceLabel: 'nearby',
        direction: 'north',
        nearestSettlementName: 'Fooville',
        nearestSettlementDirection: 'west',
        nearestSettlementDistance: 7,
        nearestSettlementDistanceLabel: 'nearby',
        nearestSettlementProximity: 'near',
      },
      message: messageWithSettlement,
    });

    const say = jest
      .fn<Promise<void>, Parameters<HandlerContext['say']>>()
      .mockResolvedValue();

    await sniffHandler({
      userId: 'U123',
      teamId: 'T1',
      say,
    } as unknown as HandlerContext);

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: messageWithSettlement,
        blocks: expect.any(Array),
      }),
    );
  });

  it('includes settlement guidance when falling back to the default copy', async () => {
    mockedSniffNearestMonster.mockResolvedValue({
      success: true,
      data: {
        detectionRadius: 1,
        nearestSettlementName: 'Fooville',
        nearestSettlementDirection: 'here',
      },
    });

    const say = jest
      .fn<Promise<void>, Parameters<HandlerContext['say']>>()
      .mockResolvedValue();

    await sniffHandler({
      userId: 'U123',
      teamId: 'T1',
      say,
    } as unknown as HandlerContext);

    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "You sniff the air but can't catch any monster scent within 1 tile. You're right in Fooville.",
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'header' }),
          expect.objectContaining({ type: 'section' }),
        ]),
      }),
    );
  });
});

describe('sniff private helpers', () => {
  const {
    appendSettlementInfo,
    messageIncludesSettlementInfo,
    buildSettlementFragment,
  } = __private__;

  it('detects settlement messaging phrases', () => {
    expect(
      messageIncludesSettlementInfo('The nearest settlement is Fooville.'),
    ).toBe(true);
    expect(
      messageIncludesSettlementInfo(
        "You're right in Fooville. Enjoy your stay.",
      ),
    ).toBe(true);
    expect(
      messageIncludesSettlementInfo(
        'You sniff the air but cannot smell anything.',
      ),
    ).toBe(false);
  });

  it('appends settlement fragments when needed', () => {
    const fragment = buildSettlementFragment({
      nearestSettlementName: 'Fooville',
      nearestSettlementDirection: 'south',
      nearestSettlementDistance: 4,
      nearestSettlementDistanceLabel: 'far off',
      nearestSettlementProximity: 'far',
    });
    expect(
      appendSettlementInfo(
        'You catch the scent of Goblin far off to the east.',
        fragment,
      ),
    ).toBe(
      'You catch the scent of Goblin far off to the east. The nearest settlement is Fooville far off to the south.',
    );
  });
});
