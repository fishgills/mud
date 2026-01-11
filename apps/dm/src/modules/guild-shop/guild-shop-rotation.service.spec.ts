import { GuildShopRotationService } from './guild-shop-rotation.service';

jest.mock('../../env', () => ({
  env: {
    GUILD_SHOP_ROTATION_SIZE: 6,
    GUILD_SHOP_ROTATION_INTERVAL_MS: 300_000,
  },
}));

describe('GuildShopRotationService', () => {
  const repository = {
    pickRandomItems: jest.fn(),
    deactivateCatalog: jest.fn(),
    createCatalogEntriesFromItems: jest.fn(),
  } as unknown as Record<string, jest.Mock>;
  const coordination = {
    exists: jest.fn(),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
    setCooldown: jest.fn(),
  } as unknown as Record<string, jest.Mock>;

  const makeService = () =>
    new GuildShopRotationService(repository as never, coordination as never);

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Math.random to return 0, so 7 + Math.floor(0 * 7) = 7
    jest.spyOn(Math, 'random').mockReturnValue(0);
    coordination.exists.mockResolvedValue(false);
    coordination.acquireLock.mockResolvedValue('token');
    coordination.releaseLock.mockResolvedValue(true);
    repository.pickRandomItems.mockResolvedValue([
      {
        id: 1,
        name: 'Item',
        description: 'desc',
        value: 50,
        type: 'consumable',
        damageRoll: '1d4',
        defense: 0,
        slot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips when cooldown is active', async () => {
    const service = makeService();
    coordination.exists.mockResolvedValue(true);

    const result = await service.rotateIfDue('manual');

    expect(result.rotated).toBe(false);
    expect(repository.pickRandomItems).not.toHaveBeenCalled();
  });

  it('performs rotation when lock is acquired', async () => {
    const service = makeService();

    const result = await service.rotateIfDue('manual');

    expect(result.rotated).toBe(true);
    // With Math.random() = 0, randomCount = 7 + Math.floor(0 * 7) = 7
    expect(repository.pickRandomItems).toHaveBeenCalledWith(7);
    expect(repository.deactivateCatalog).toHaveBeenCalled();
    expect(repository.createCatalogEntriesFromItems).toHaveBeenCalled();
    expect(coordination.setCooldown).toHaveBeenCalled();
  });

  it('returns false when no items are available', async () => {
    const service = makeService();
    repository.pickRandomItems.mockResolvedValue([]);

    const result = await service.rotateIfDue('tick');

    expect(result.rotated).toBe(false);
    expect(repository.deactivateCatalog).not.toHaveBeenCalled();
  });
});
