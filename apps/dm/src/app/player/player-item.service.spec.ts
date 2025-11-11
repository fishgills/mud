import type { Prisma } from '@mud/database';
import { PlayerItemService } from './player-item.service';
import { PlayerSlot, ItemQuality } from '@mud/database';
import type { EquippedPlayerItem } from './equipment.effects';
import { ErrCodes } from '../errors/app-error';

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('token-123'),
}));

// Mock the prisma client returned by @mud/database so we can unit-test equip logic.
// Share the same delegates for top-level access and transactional usage.
const playerItemDelegate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  updateMany: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const worldItemDelegate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const playerDelegate = {
  findUnique: jest.fn(),
};

const resetDelegateMocks = (
  delegate: Record<string, jest.Mock<unknown, unknown[]>>,
): void => {
  Object.values(delegate).forEach((mockFn) => mockFn.mockReset());
};

const mockTx = {
  playerItem: playerItemDelegate,
  worldItem: worldItemDelegate,
  player: playerDelegate,
} as unknown as Prisma.TransactionClient;

const mockPrisma = {
  playerItem: playerItemDelegate,
  worldItem: worldItemDelegate,
  player: playerDelegate,
  $transaction: jest.fn(
    (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      Promise.resolve(cb(mockTx)),
  ),
} as unknown as {
  playerItem: typeof playerItemDelegate;
  worldItem: typeof worldItemDelegate;
  player: typeof playerDelegate;
  $transaction: (
    cb: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) => Promise<unknown>;
};

jest.mock('@mud/database', () => {
  const actual = jest.requireActual<typeof import('@mud/database')>(
    '@mud/database',
  );
  return {
    ...actual,
    getPrismaClient: () => mockPrisma,
  };
});

// Mock redis client createClient — typed interface for the subset of methods used
type MockRedis = {
  connect: jest.Mock<Promise<void>, []>;
  disconnect: jest.Mock<Promise<void>, []>;
  set: jest.Mock<Promise<string | null>, [string, string, unknown?]>;
  get: jest.Mock<Promise<string | null>, [string]>;
  del: jest.Mock<Promise<number>, [string]>;
  eval?: jest.Mock<Promise<number>, [string, unknown?]>;
};

const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  eval: jest.fn().mockResolvedValue(1),
} as unknown as MockRedis;

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

describe('PlayerItemService.equip validations', () => {
  let svc: PlayerItemService;

  beforeEach(() => {
    // reset mocks
    resetDelegateMocks(playerItemDelegate);
    resetDelegateMocks(worldItemDelegate);
    resetDelegateMocks(playerDelegate);
    mockPrisma.$transaction.mockClear();
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        Promise.resolve(cb(mockTx)),
    );
    svc = new PlayerItemService();
  });

  it('equips a valid item into allowed slot', async () => {
    const pi = { id: 1, playerId: 42, item: { slot: PlayerSlot.head } };
    mockTx.playerItem.findUnique.mockResolvedValueOnce(pi);
    mockTx.playerItem.updateMany.mockResolvedValueOnce({});
    mockTx.playerItem.update.mockResolvedValueOnce({ item: {} });

    await expect(svc.equip(42, 1, PlayerSlot.head)).resolves.toEqual({
      item: {},
    });

    expect(mockTx.playerItem.updateMany).toHaveBeenCalledWith({
      where: { playerId: 42, slot: PlayerSlot.head, equipped: true },
      data: { equipped: false, slot: null },
    });
    expect(mockTx.playerItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { equipped: true, slot: PlayerSlot.head },
      include: { item: true },
    });
  });

  it('swaps item when equipping to an already-equipped slot', async () => {
    // New weapon to equip
    const newWeapon = { id: 10, playerId: 42, item: { type: 'weapon' } };
    mockTx.playerItem.findUnique.mockResolvedValueOnce(newWeapon);
    mockTx.playerItem.updateMany.mockResolvedValueOnce({ count: 1 });
    mockTx.playerItem.update.mockResolvedValueOnce({ item: {} });

    await expect(svc.equip(42, 10, PlayerSlot.weapon)).resolves.toEqual({
      item: {},
    });

    // Should unequip any existing weapon and clear its slot
    expect(mockTx.playerItem.updateMany).toHaveBeenCalledWith({
      where: { playerId: 42, slot: PlayerSlot.weapon, equipped: true },
      data: { equipped: false, slot: null },
    });
    // Should equip the new weapon
    expect(mockTx.playerItem.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { equipped: true, slot: PlayerSlot.weapon },
      include: { item: true },
    });
  });

  it('rejects when requesting an invalid slot name', async () => {
    const pi = { id: 2, playerId: 43, item: { slot: PlayerSlot.chest } };
    mockTx.playerItem.findUnique.mockResolvedValueOnce(pi);

    await expect(
      svc.equip(43, 2, 'neck' as unknown as PlayerSlot),
    ).rejects.toMatchObject({
      code: ErrCodes.INVALID_SLOT,
    });
  });

  it('rejects non-equipable items', async () => {
    const pi = {
      id: 3,
      playerId: 44,
      item: { /* no slot, not a weapon */ type: 'consumable' },
    };
    mockTx.playerItem.findUnique.mockResolvedValueOnce(pi);

    await expect(svc.equip(44, 3, PlayerSlot.head)).rejects.toMatchObject({
      code: ErrCodes.ITEM_NOT_EQUIPPABLE,
    });
  });

  it('rejects when player does not own the item', async () => {
    mockTx.playerItem.findUnique.mockResolvedValueOnce(null);

    await expect(svc.equip(100, 999, PlayerSlot.head)).rejects.toMatchObject({
      code: ErrCodes.NOT_OWNED,
    });
  });

  describe('pickup locking behavior', () => {
    beforeEach(() => {
      // reset redis mocks
      mockRedisClient.connect.mockClear();
      mockRedisClient.disconnect.mockClear();
      mockRedisClient.set.mockReset();
      mockRedisClient.get.mockReset();
      mockRedisClient.del.mockReset();
      mockRedisClient.eval.mockClear();
    });

    it('successfully picks up when lock available', async () => {
      // lock acquired
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockRedisClient.get.mockResolvedValueOnce('token-123');

      // world item and player checks
      const worldItem = { id: 5, itemId: 200, quantity: 1, quality: 'COMMON' };
      const player = { id: 42, strength: 0, x: 0, y: 0 };

      const txx = {
        worldItem: {
          findUnique: jest.fn().mockResolvedValueOnce(worldItem),
          delete: jest.fn().mockResolvedValueOnce({}),
        },
        player: { findUnique: jest.fn().mockResolvedValueOnce(player) },
        playerItem: {
          count: jest.fn().mockResolvedValueOnce(0),
          create: jest.fn().mockResolvedValueOnce({ id: 77, itemId: 200 }),
        },
      } as unknown as Prisma.TransactionClient;

      mockPrisma.$transaction.mockImplementationOnce(
        (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          Promise.resolve(cb(txx)),
      );

      const res = await svc.pickup(42, 5);
      expect(res).toMatchObject({ id: 77, itemId: 200 });
      expect(mockRedisClient.set).toHaveBeenCalled();
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('throws LOCKED when lock not acquired', async () => {
      // lock acquisition fails
      mockRedisClient.set.mockResolvedValueOnce(null);

      // Ensure prisma transaction is not called
      mockPrisma.$transaction.mockClear();

      await expect(svc.pickup(42, 6)).rejects.toMatchObject({
        code: ErrCodes.LOCKED,
      });
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('bag and world item helpers', () => {
    it('lists bag items with item details', async () => {
      const bagItems = [{ id: 1 }, { id: 2 }] as Array<
        Record<string, unknown>
      >;
      mockPrisma.playerItem.findMany.mockResolvedValueOnce(bagItems);

      const result = await svc.listBag(7);

      expect(mockPrisma.playerItem.findMany).toHaveBeenCalledWith({
        where: { playerId: 7 },
        include: { item: true },
      });
      expect(result).toBe(bagItems);
    });

    it('lists equipped items with item details', async () => {
      const equipped = [{ id: 10 }] as Array<Record<string, unknown>>;
      mockPrisma.playerItem.findMany.mockResolvedValueOnce(equipped);

      const result = await svc.listEquipped(3);

      expect(mockPrisma.playerItem.findMany).toHaveBeenCalledWith({
        where: { playerId: 3, equipped: true },
        include: { item: true },
      });
      expect(result).toBe(equipped);
    });

    it('aggregates equipped item bonuses', async () => {
      mockPrisma.playerItem.findMany.mockResolvedValueOnce([
        {
          id: 1,
          playerId: 9,
          slot: PlayerSlot.weapon,
          quality: ItemQuality.Uncommon,
          item: { attack: 4, defense: 0, healthBonus: 0, slot: PlayerSlot.weapon },
        },
        {
          id: 2,
          playerId: 9,
          slot: PlayerSlot.chest,
          quality: ItemQuality.Rare,
          item: { attack: 0, defense: 3, healthBonus: 0, slot: PlayerSlot.chest },
        },
        {
          id: 3,
          playerId: 9,
          slot: PlayerSlot.head,
          quality: ItemQuality.Common,
          item: { attack: 0, defense: 0, healthBonus: 10, slot: PlayerSlot.head },
        },
      ] as unknown as EquippedPlayerItem[]);

      const totals = await svc.getEquipmentTotals(9);

      expect(totals).toEqual({
        attackBonus: 2,
        damageBonus: 5,
        armorBonus: 5,
        vitalityBonus: 10,
      });
    });

    it('unequips items that belong to the player', async () => {
      mockPrisma.playerItem.findUnique.mockResolvedValueOnce({
        id: 11,
        playerId: 5,
      });
      const updated = { id: 11, equipped: false, slot: null, item: {} };
      mockPrisma.playerItem.update.mockResolvedValueOnce(updated);

      const result = await svc.unequip(5, 11);

      expect(result).toBe(updated);
      expect(mockPrisma.playerItem.update).toHaveBeenCalledWith({
        where: { id: 11 },
        data: { equipped: false, slot: null },
        include: { item: true },
      });
    });

    it('rejects unequip attempts for missing items', async () => {
      mockPrisma.playerItem.findUnique.mockResolvedValueOnce(null);

      await expect(svc.unequip(1, 2)).rejects.toMatchObject({
        code: ErrCodes.NOT_OWNED,
      });
    });

    it('drops an owned item at the player location', async () => {
      const tx = {
        playerItem: {
          findUnique: jest.fn().mockResolvedValueOnce({
            id: 50,
            playerId: 9,
            itemId: 400,
            quality: 'RARE',
            quantity: 3,
          }),
          delete: jest.fn().mockResolvedValueOnce({}),
        },
        player: {
          findUnique: jest.fn().mockResolvedValueOnce({ id: 9, x: 4, y: 8 }),
        },
        worldItem: {
          create: jest.fn().mockResolvedValueOnce({
            id: 123,
            itemId: 400,
            x: 4,
            y: 8,
            item: { name: 'Sword' },
          }),
        },
      } as unknown as Prisma.TransactionClient;

      mockPrisma.$transaction.mockImplementationOnce(
        (cb: (innerTx: Prisma.TransactionClient) => Promise<unknown>) =>
          Promise.resolve(cb(tx)),
      );

      const dropped = await svc.drop(9, 50);

      expect(tx.worldItem.create).toHaveBeenCalledWith({
        data: {
          itemId: 400,
          quality: 'RARE',
          x: 4,
          y: 8,
          quantity: 3,
          spawnedByMonsterId: null,
        },
        include: { item: true },
      });
      expect(tx.playerItem.delete).toHaveBeenCalledWith({ where: { id: 50 } });
      expect(dropped).toEqual({
        id: 123,
        itemId: 400,
        x: 4,
        y: 8,
        item: { name: 'Sword' },
      });
    });

    it('throws when the player record cannot be found during drop', async () => {
      const tx = {
        playerItem: {
          findUnique: jest.fn().mockResolvedValueOnce({
            id: 60,
            playerId: 10,
            itemId: 2,
          }),
        },
        player: {
          findUnique: jest.fn().mockResolvedValueOnce(null),
        },
      } as unknown as Prisma.TransactionClient;

      mockPrisma.$transaction.mockImplementationOnce(
        (cb: (innerTx: Prisma.TransactionClient) => Promise<unknown>) =>
          Promise.resolve(cb(tx)),
      );

      await expect(svc.drop(10, 60)).rejects.toThrow('Player not found');
    });

    it('lists world items at a given location', async () => {
      const worldItems = [{ id: 1, x: 0, y: 0 }];
      mockPrisma.worldItem.findMany.mockResolvedValueOnce(worldItems);

      const result = await svc.listWorldItemsAtLocation(0, 0);

      expect(mockPrisma.worldItem.findMany).toHaveBeenCalledWith({
        where: { x: 0, y: 0 },
        include: { item: true },
      });
      expect(result).toBe(worldItems);
    });
  });
});
