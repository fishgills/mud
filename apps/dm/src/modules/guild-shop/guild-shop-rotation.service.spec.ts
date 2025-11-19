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
        attack: 0,
        defense: 0,
        healthBonus: 0,
        slot: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    ]);
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
    expect(repository.pickRandomItems).toHaveBeenCalledWith(6);
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
