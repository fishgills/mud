import { GuildShopRotationService } from './guild-shop-rotation.service';
import { generateShopListings, hasChaseItem } from './guild-shop-progression';
import { ItemQuality, ItemType, PlayerSlot } from '@mud/database';
import type { GeneratedShopListing } from './guild-shop-progression';

jest.mock('../../env', () => ({
  env: {
    GUILD_SHOP_ROTATION_INTERVAL_MS: 300_000,
    ACTIVE_PLAYER_WINDOW_MINUTES: 30,
  },
}));

jest.mock('./guild-shop-progression', () => ({
  computeGlobalTier: jest.fn(() => 3),
  generateShopListings: jest.fn(),
  hasChaseItem: jest.fn(),
}));

describe('GuildShopRotationService', () => {
  const repository = {
    getShopState: jest.fn(),
    getMedianPlayerLevel: jest.fn(),
    replaceCatalog: jest.fn(),
  } as unknown as Record<string, jest.Mock>;
  const coordination = {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  } as unknown as Record<string, jest.Mock>;
  const publisher = {
    publishRefresh: jest.fn(),
  } as unknown as Record<string, jest.Mock>;

  const listing: GeneratedShopListing = {
    name: 'Fierce Blade',
    description: 'Tier 3 blade.',
    slot: PlayerSlot.weapon,
    itemType: ItemType.WEAPON,
    tier: 3,
    offsetK: 0,
    itemPower: 12,
    strengthBonus: 8,
    agilityBonus: 4,
    healthBonus: 0,
    weaponDiceCount: 1,
    weaponDiceSides: 6,
    priceGold: 24,
    stockQuantity: 2,
    quality: ItemQuality.Common,
    tags: ['tier:3'],
    archetype: 'Offense',
    ticketRequirement: null,
  };

  const makeService = () =>
    new GuildShopRotationService(
      repository as never,
      coordination as never,
      publisher as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    coordination.acquireLock.mockResolvedValue('token');
    coordination.releaseLock.mockResolvedValue(true);
    publisher.publishRefresh.mockResolvedValue(undefined);
    repository.getMedianPlayerLevel.mockResolvedValue(5);
    (generateShopListings as jest.Mock).mockReturnValue([listing]);
    (hasChaseItem as jest.Mock).mockReturnValue(false);
  });

  it('skips rotation when not due', async () => {
    const service = makeService();
    repository.getShopState.mockResolvedValue({
      id: 1,
      refreshId: 'prev',
      refreshesSinceChase: 1,
      globalTier: 2,
      medianLevel: 2,
      lastRefreshedAt: new Date(),
    });

    const result = await service.rotateIfDue('tick');

    expect(result.rotated).toBe(false);
    expect(repository.replaceCatalog).not.toHaveBeenCalled();
  });

  it('rotates when due', async () => {
    const service = makeService();
    repository.getShopState.mockResolvedValue({
      id: 1,
      refreshId: 'prev',
      refreshesSinceChase: 1,
      globalTier: 2,
      medianLevel: 2,
      lastRefreshedAt: new Date(Date.now() - 600_000),
    });

    const result = await service.rotateIfDue('tick');

    expect(result.rotated).toBe(true);
    expect(repository.replaceCatalog).toHaveBeenCalledWith(
      [listing],
      expect.objectContaining({
        globalTier: 3,
        medianLevel: 5,
      }),
    );
    expect(publisher.publishRefresh).toHaveBeenCalledWith({
      source: 'tick',
      items: 1,
    });
  });

  it('resets chase counter when a chase item appears', async () => {
    const service = makeService();
    repository.getShopState.mockResolvedValue({
      id: 1,
      refreshId: 'prev',
      refreshesSinceChase: 5,
      globalTier: 2,
      medianLevel: 2,
      lastRefreshedAt: new Date(Date.now() - 600_000),
    });
    (hasChaseItem as jest.Mock).mockReturnValue(true);

    await service.rotateIfDue('tick');

    expect(repository.replaceCatalog).toHaveBeenCalledWith(
      [listing],
      expect.objectContaining({
        refreshesSinceChase: 0,
      }),
    );
  });
});
