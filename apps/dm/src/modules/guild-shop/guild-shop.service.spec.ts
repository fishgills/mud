import { GuildShopService } from './guild-shop.service';

describe('guild-shop GuildShopService', () => {
  const playerService = {
    getPlayer: jest.fn(),
  } as unknown as { getPlayer: jest.Mock };
  const repository = {
    findCatalogItemBySku: jest.fn(),
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
  const runsService = {
    getActiveRunForPlayer: jest.fn(),
  } as unknown as { getActiveRunForPlayer: jest.Mock };

  const makeService = () =>
    new GuildShopService(
      playerService as never,
      repository as never,
      publisher as never,
      runsService as never,
    );

  const player = {
    id: 42,
    teamId: 'T1',
    userId: 'U1',
    gold: 500,
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    playerService.getPlayer.mockResolvedValue(player);
    runsService.getActiveRunForPlayer.mockResolvedValue(null);
  });

  it('buys catalog item and publishes receipt', async () => {
    const service = makeService();
    repository.findCatalogItemBySku.mockResolvedValue({
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
      sku: 'potion',
    });

    expect(runsService.getActiveRunForPlayer).toHaveBeenCalledWith(42);
    expect(response.direction).toBe('BUY');
    expect(publisher.publishReceipt).toHaveBeenCalled();
    expect(repository.findCatalogItemBySku).toHaveBeenCalledWith('potion');
  });

  it('blocks purchases while a raid is active', async () => {
    const service = makeService();
    runsService.getActiveRunForPlayer.mockResolvedValue({ runId: 1 });

    await expect(
      service.buy({
        teamId: 'T1',
        userId: 'U1',
        sku: 'potion',
      }),
    ).rejects.toThrow('Finish your raid before trading.');
  });

  it('sells player item and publishes receipt', async () => {
    const service = makeService();
    repository.getPlayerItemById.mockResolvedValue({
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
      playerItemId: 77,
    });

    expect(runsService.getActiveRunForPlayer).toHaveBeenCalledWith(42);
    expect(response.direction).toBe('SELL');
    expect(publisher.publishReceipt).toHaveBeenCalled();
  });

  it('sells unlisted item and publishes receipt', async () => {
    const service = makeService();
    repository.getPlayerItemById.mockResolvedValue({
      id: 78,
      itemId: 6,
      quantity: 1,
    });
    repository.findCatalogByTemplate.mockResolvedValue(null);
    repository.sellItem.mockResolvedValue({
      updatedPlayer: { ...player, gold: 505 },
      catalogItem: null,
      removedPlayerItemId: 78,
      receipt: { id: 9, goldDelta: 5, quantity: 1 },
    });

    const response = await service.sell({
      teamId: 'T1',
      userId: 'U1',
      playerItemId: 78,
    });

    expect(response.direction).toBe('SELL');
    expect(response.itemId).toBe('0');
    expect(publisher.publishReceipt).toHaveBeenCalled();
  });

  it('handles full stack sale (item deletion) correctly', async () => {
    const service = makeService();
    repository.getPlayerItemById.mockResolvedValue({
      id: 79,
      itemId: 7,
      quantity: 5,
    });
    repository.findCatalogByTemplate.mockResolvedValue(null);
    repository.sellItem.mockResolvedValue({
      updatedPlayer: { ...player, gold: 600 },
      catalogItem: null,
      removedPlayerItemId: 79,
      receipt: { id: 10, goldDelta: 100, quantity: 5 },
      itemName: 'Rusty Sword',
      itemQuality: 'Poor',
    });

    const response = await service.sell({
      teamId: 'T1',
      userId: 'U1',
      playerItemId: 79,
      quantity: 5,
    });

    expect(response.direction).toBe('SELL');
    expect(response.itemName).toBe('Rusty Sword');
    expect(response.itemQuality).toBe('Poor');
    expect(publisher.publishReceipt).toHaveBeenCalled();
  });
});
