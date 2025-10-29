import type { Prisma } from '@prisma/client';
import { PlayerItemService } from './player-item.service';
import { PlayerSlot } from '@prisma/client';
import { ErrCodes } from '../errors/app-error';

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('token-123'),
}));

// Mock the prisma client returned by @mud/database so we can unit-test equip logic.
// Use Prisma.TransactionClient as the shape to avoid `any`.
const mockTx = {
  playerItem: {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
} as unknown as Prisma.TransactionClient;

const mockPrisma = {
  $transaction: jest.fn(
    (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      Promise.resolve(cb(mockTx)),
  ),
} as unknown as {
  $transaction: (
    cb: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) => Promise<unknown>;
};

jest.mock('@mud/database', () => ({
  getPrismaClient: () => mockPrisma,
}));

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
    mockTx.playerItem.findUnique.mockReset();
    mockTx.playerItem.updateMany.mockReset();
    mockTx.playerItem.update.mockReset();
    mockPrisma.$transaction.mockClear();
    svc = new PlayerItemService();
  });

  it('equips a valid item into allowed slot', async () => {
    const pi = { id: 1, playerId: 42, item: { slot: 'head' } };
    mockTx.playerItem.findUnique.mockResolvedValueOnce(pi);
    mockTx.playerItem.updateMany.mockResolvedValueOnce({});
    mockTx.playerItem.update.mockResolvedValueOnce({});

    await expect(svc.equip(42, 1, PlayerSlot.head)).resolves.toBeUndefined();

    expect(mockTx.playerItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { equipped: true, slot: 'head' },
    });
  });

  it('rejects when requesting an invalid slot name', async () => {
    const pi = { id: 2, playerId: 43, item: { slot: 'chest' } };
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
});
