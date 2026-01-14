import type { Prisma } from '@mud/database';
import { PlayerItemService } from './player-item.service';
import { PlayerSlot } from '@mud/database';
import { ErrCodes } from '../errors/app-error';

const playerItemDelegate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  updateMany: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
};

const resetDelegateMocks = (
  delegate: Record<string, jest.Mock<unknown, unknown[]>>,
): void => {
  Object.values(delegate).forEach((mockFn) => mockFn.mockReset());
};

const mockTx = {
  playerItem: playerItemDelegate,
} as unknown as Prisma.TransactionClient;

const mockPrisma = {
  playerItem: playerItemDelegate,
  $transaction: jest.fn(
    (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      Promise.resolve(cb(mockTx)),
  ),
} as unknown as {
  playerItem: typeof playerItemDelegate;
  $transaction: (
    cb: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) => Promise<unknown>;
};

jest.mock('@mud/database', () => {
  const actual =
    jest.requireActual<typeof import('@mud/database')>('@mud/database');
  return {
    ...actual,
    getPrismaClient: () => mockPrisma,
  };
});

describe('PlayerItemService', () => {
  let svc: PlayerItemService;

  beforeEach(() => {
    resetDelegateMocks(playerItemDelegate);
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
      item: { type: 'consumable' },
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
});
