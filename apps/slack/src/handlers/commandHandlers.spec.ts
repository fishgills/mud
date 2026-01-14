jest.mock('../dm-client', () => {
  const dmClient = {
    attack: jest.fn(),
    getPlayer: jest.fn(),
    guildBuyItem: jest.fn(),
    guildListCatalog: jest.fn(),
  };
  return { dmClient };
});

import { dmClient } from '../dm-client';
import { AttackOrigin, TargetType } from '../dm-types';
import { attackHandler } from './attack';
import { buyHandler } from './buy';
import { catalogHandler } from './catalog';
import type { HandlerContext, SayMessage } from './types';

const mockedDmClient = dmClient as unknown as {
  attack: jest.Mock;
  getPlayer: jest.Mock;
  guildBuyItem: jest.Mock;
  guildListCatalog: jest.Mock;
};

const makeSay = () =>
  jest.fn<Promise<void>, [SayMessage]>().mockResolvedValue(undefined);

describe('command handlers', () => {
  beforeEach(() => {
    mockedDmClient.attack.mockReset();
    mockedDmClient.getPlayer.mockReset();
    mockedDmClient.guildBuyItem.mockReset();
    mockedDmClient.guildListCatalog.mockReset();
    mockedDmClient.getPlayer.mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Hero', isCreationComplete: true },
    });
  });

  it('duels a mentioned player', async () => {
    const say = makeSay();
    mockedDmClient.attack.mockResolvedValueOnce({ success: true });

    await attackHandler.handle({
      userId: 'U1',
      text: 'attack <@U2>',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.attack).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
      input: {
        targetType: TargetType.Player,
        targetUserId: 'U2',
        targetTeamId: 'T1',
        targetName: undefined,
        attackOrigin: AttackOrigin.TextPvp,
      },
    });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Duel started. Check your DMs for combat results.',
      }),
    );
  });

  it('duels a player by name', async () => {
    const say = makeSay();
    mockedDmClient.attack.mockResolvedValueOnce({ success: true });

    await attackHandler.handle({
      userId: 'U1',
      text: 'attack @Specter',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.attack).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
      input: {
        targetType: TargetType.Player,
        targetUserId: undefined,
        targetTeamId: undefined,
        targetName: 'Specter',
        attackOrigin: undefined,
      },
    });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Duel started. Check your DMs for combat results.',
      }),
    );
  });

  it('buys items when a sku is provided', async () => {
    const say = makeSay();
    mockedDmClient.guildBuyItem.mockResolvedValueOnce({
      receiptId: 'R1',
      goldDelta: -10,
      remainingGold: 25,
    });

    await buyHandler.handle({
      userId: 'U1',
      text: 'buy iron-sword',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.guildBuyItem).toHaveBeenCalledWith({
      teamId: 'T1',
      userId: 'U1',
      sku: 'iron-sword',
    });
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({
        text: '🛒 Purchased iron-sword for 10 gold. Remaining gold: 25.',
      }),
    );
  });

  it('renders the catalog list', async () => {
    const say = makeSay();
    mockedDmClient.guildListCatalog.mockResolvedValueOnce([
      {
        sku: 'iron-sword',
        name: 'Iron Sword',
        cost: 10,
        description: 'A sturdy blade.',
      },
    ]);

    await catalogHandler.handle({
      userId: 'U1',
      text: 'catalog',
      say,
      teamId: 'T1',
    } as HandlerContext);

    expect(mockedDmClient.guildListCatalog).toHaveBeenCalled();
    expect(say).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Guild shop catalog' }),
    );
  });
});
