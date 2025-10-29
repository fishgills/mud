/**
 * Integration-style unit test for pickup locking using an in-memory Redis mock.
 * This test avoids any external infrastructure and is safe to run in CI.
 */

// Minimal in-memory redis-like store (typed)
const mockStore: Map<string, { value: string; expiresAt: number | null }> =
  new Map();

function redisSet(
  key: string,
  value: string,
  opts: { NX?: boolean; PX?: number } = {},
): string | null {
  const now = Date.now();
  const existing = mockStore.get(key);
  if (existing && existing.expiresAt && existing.expiresAt <= now)
    mockStore.delete(key);
  if (opts.NX) {
    if (mockStore.has(key)) return null;
    const expiresAt = opts.PX ? now + opts.PX : null;
    mockStore.set(key, { value, expiresAt });
    return 'OK';
  }
  const expiresAt = opts.PX ? now + opts.PX : null;
  mockStore.set(key, { value, expiresAt });
  return 'OK';
}

function redisGet(key: string): string | null {
  const now = Date.now();
  const v = mockStore.get(key);
  if (!v) return null;
  if (v.expiresAt && v.expiresAt <= now) {
    mockStore.delete(key);
    return null;
  }
  return v.value;
}

function redisDel(key: string): number {
  return mockStore.delete(key) ? 1 : 0;
}

// Provide a minimal redis client factory that the service expects.
jest.mock('redis', () => ({
  createClient: () => ({
    connect: async () => {},
    disconnect: async () => {},
    set: async (
      key: string,
      value: string,
      opts?: { NX?: boolean; PX?: number },
    ) => redisSet(key, value, opts),
    get: async (key: string) => redisGet(key),
    del: async (key: string) => redisDel(key),
  }),
}));

// Fake prisma transaction object — only the pieces used by pickup()
type PlayerRow = { id: number; strength: number; x: number; y: number };
type WorldItemRow = {
  id: number;
  itemId: number;
  quantity: number;
  quality: number;
};
const createdPlayerItems: Array<Record<string, unknown>> = [];

const mockTransaction = {
  worldItem: {
    findUnique: async ({ where: { id } }: { where: { id: number } }) => {
      if (id === 1)
        return { id: 1, itemId: 10, quantity: 1, quality: 1 } as WorldItemRow;
      return null;
    },
    delete: async ({ where: { id } }: { where: { id: number } }) => ({ id }),
  },
  player: {
    findUnique: async ({ where: { id } }: { where: { id: number } }) => {
      if (id === 99) return { id: 99, strength: 0, x: 0, y: 0 } as PlayerRow;
      return null;
    },
  },
  playerItem: {
    count: async () => 0,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const created = {
        id: 500 + createdPlayerItems.length,
        ...data,
      } as Record<string, unknown>;
      createdPlayerItems.push(created);
      return created;
    },
  },
};

// Mock getPrismaClient to supply $transaction
jest.mock('@mud/database', () => ({
  getPrismaClient: () => ({
    $transaction: async (
      cb: (tx: typeof mockTransaction) => Promise<unknown>,
    ) => cb(mockTransaction),
  }),
}));

import { PlayerItemService } from './player-item.service';
import { AppError, ErrCodes } from '../errors/app-error';

describe('PlayerItemService pickup locking (in-memory redis)', () => {
  let svc: PlayerItemService;

  beforeEach(() => {
    // reset internal store and created items
    mockStore.clear();
    createdPlayerItems.length = 0;
    svc = new PlayerItemService();
  });

  test('concurrent pickup: only one acquires the lock and picks up', async () => {
    const playerId = 99;
    const worldItemId = 1;

    // Start two concurrent pickup attempts
    const p1 = svc.pickup(playerId, worldItemId);
    const p2 = svc.pickup(playerId, worldItemId);

    const results = await Promise.allSettled([p1, p2]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // Check the rejection is the LOCKED AppError
    const rej = rejected[0] as PromiseRejectedResult;
    expect(rej.reason).toBeInstanceOf(AppError);
    expect((rej.reason as AppError).code).toBe(ErrCodes.LOCKED);

    // Ensure one PlayerItem was created
    expect(createdPlayerItems.length).toBe(1);

    // Ensure the lock key was released (best-effort) and store has no leftover lock
    const lockKey = `lock:pickup:${worldItemId}`;
    expect(redisGet(lockKey)).toBeNull();
  });
});
