import { BadRequestException } from '@nestjs/common';
import { GuildShopService } from './guild-shop.service';

describe('guild-shop GuildShopService', () => {
  const playerService = {
    getPlayer: jest.fn(),
  } as unknown as { getPlayer: jest.Mock };
  const repository = {
    findCatalogItemByTerm: jest.fn(),
    findCatalogByTemplate: jest.fn(),
    purchaseItem: jest.fn(),
    sellItem: jest.fn(),
    getPlayerItemByName: jest.fn(),
    getPlayerItemById: jest.fn(),
  } as unknown as Record<string, jest.Mock>;
  const publisher = {
    publishReceipt: jest.fn(),
  } as unknown as { publishReceipt: jest.Mock };

  const makeService = () =>
    new GuildShopService(
      playerService as never,
      repository as never,
      publisher as never,
    );

  const player = {
    id: 42,
    teamId: 'T1',
    userId: 'U1',
    gold: 500,
    isInHq: true,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    playerService.getPlayer.mockResolvedValue(player);
  });

  it('rejects when player is not inside guild', async () => {
    const service = makeService();
    playerService.getPlayer.mockResolvedValue({ ...player, isInHq: false });

    await expect(
      service.buy({ teamId: 'T1', userId: 'U1', item: 'potion' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('buys catalog item and publishes receipt', async () => {
    const service = makeService();
    repository.findCatalogItemByTerm.mockResolvedValue({
      id: 10,
      sellPriceGold: 5,
      stockQuantity: 10,
    });
    repository.purchaseItem.mockResolvedValue({
      updatedPlayer: { ...player, gold: 400 },
      catalogItem: { id: 10, sellPriceGold: 5, stockQuantity: 10 },
      createdPlayerItem: { id: 99, quantity: 1 },
      receipt: { id: 7, goldDelta: -100, quantity: 1 },
    });

    const response = await service.buy({
      teamId: 'T1',
      userId: 'U1',
      item: 'potion',
    });

    expect(response.direction).toBe('BUY');
    expect(publisher.publishReceipt).toHaveBeenCalled();
  });

  it('sells player item and publishes receipt', async () => {
    const service = makeService();
    repository.getPlayerItemByName.mockResolvedValue({
      id: 77,
      itemId: 5,
      quantity: 1,
    });
    repository.findCatalogByTemplate.mockResolvedValue({
      id: 20,
      sellPriceGold: 25,
      stockQuantity: 1,
    });
    repository.sellItem.mockResolvedValue({
      updatedPlayer: { ...player, gold: 525 },
      catalogItem: { id: 20, sellPriceGold: 25, stockQuantity: 1 },
      removedPlayerItemId: 77,
      receipt: { id: 8, goldDelta: 25, quantity: 1 },
    });

    const response = await service.sell({
      teamId: 'T1',
      userId: 'U1',
      item: 'sword',
    });

    expect(response.direction).toBe('SELL');
    expect(publisher.publishReceipt).toHaveBeenCalled();
  });
});
