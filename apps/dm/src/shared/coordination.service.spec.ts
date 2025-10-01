import type { CoordinationService as CoordinationServiceType } from './coordination.service';

type RedisClientMock = {
  on: jest.MockedFunction<(event: string, listener: (...args: unknown[]) => void) => unknown>;
  connect: jest.MockedFunction<() => Promise<void>>;
  exists: jest.MockedFunction<(key: string) => Promise<number>>;
  set: jest.MockedFunction<(
    key: string,
    value: string,
    options?: { NX?: boolean; PX?: number },
  ) => Promise<'OK' | null>>;
  eval: jest.MockedFunction<(
    script: string,
    args: { keys: string[]; arguments: string[] },
  ) => Promise<number>>;
  quit: jest.MockedFunction<() => Promise<void>>;
};

const createRedisClientMock = (): RedisClientMock => ({
  on: jest.fn().mockReturnThis(),
  connect: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn(),
  set: jest.fn(),
  eval: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
});

type EnvOverrides = {
  REDIS_URL?: string;
  COORDINATION_PREFIX?: string;
};

const instantiateService = (overrides: EnvOverrides = {}) => {
  let ServiceClass: { new (): CoordinationServiceType };
  let client: RedisClientMock | undefined;

  jest.resetModules();

  jest.isolateModules(() => {
    jest.doMock('redis', () => ({
      createClient: () => {
        client = createRedisClientMock();
        return client;
      },
    }));

    jest.doMock('../env', () => ({
      env: {
        REDIS_URL: overrides.REDIS_URL ?? 'redis://localhost:6379',
        COORDINATION_PREFIX: overrides.COORDINATION_PREFIX ?? 'test:',
      },
    }));

    ({ CoordinationService: ServiceClass } = require('./coordination.service'));
  });

  const service = new ServiceClass();
  return { service, client };
};

describe('CoordinationService', () => {
  it('disables coordination features when Redis is not configured', async () => {
    const { service, client } = instantiateService({ REDIS_URL: '' });

    expect(client).toBeUndefined();
    expect(service.isEnabled()).toBe(false);
    await expect(service.exists('lock')).resolves.toBe(false);
    await expect(service.acquireLock('key', 'token', 1000)).resolves.toBeNull();
    await expect(service.releaseLock('key', 'token')).resolves.toBe(false);
    await expect(service.setCooldown('key', 500)).resolves.toBeUndefined();
  });

  it('interacts with Redis when coordination is enabled', async () => {
    const { service, client } = instantiateService();
    expect(client).toBeDefined();

    const redis = client!;

    expect(redis.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(redis.connect).toHaveBeenCalled();
    expect(service.isEnabled()).toBe(true);

    redis.exists.mockResolvedValueOnce(1);
    await expect(service.exists('present')).resolves.toBe(true);

    redis.exists.mockRejectedValueOnce(new Error('boom'));
    await expect(service.exists('error')).resolves.toBe(false);

    redis.set.mockResolvedValueOnce('OK');
    await expect(service.acquireLock('lock', 'token', 1500)).resolves.toBe('token');
    expect(redis.set).toHaveBeenCalledWith('test:lock', 'token', { NX: true, PX: 1500 });

    redis.set.mockResolvedValueOnce(null);
    await expect(service.acquireLock('lock', 'token', 1500)).resolves.toBeNull();

    redis.set.mockRejectedValueOnce(new Error('fail'));
    await expect(service.acquireLock('lock', 'token', 1500)).resolves.toBeNull();

    redis.eval.mockResolvedValueOnce(1);
    await expect(service.releaseLock('lock', 'token')).resolves.toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(expect.any(String), {
      keys: ['test:lock'],
      arguments: ['token'],
    });

    redis.eval.mockResolvedValueOnce(0);
    await expect(service.releaseLock('lock', 'token')).resolves.toBe(false);

    redis.eval.mockRejectedValueOnce(new Error('oops'));
    await expect(service.releaseLock('lock', 'token')).resolves.toBe(false);

    redis.set.mockResolvedValueOnce('OK');
    await expect(service.setCooldown('cool', 2000)).resolves.toBeUndefined();
    expect(redis.set).toHaveBeenLastCalledWith('test:cool', '1', { PX: 2000 });

    redis.set.mockRejectedValueOnce(new Error('ignore'));
    await expect(service.setCooldown('cool', 2000)).resolves.toBeUndefined();

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    expect(redis.quit).toHaveBeenCalled();
  });

  it('swallows errors when closing the Redis connection', async () => {
    const { service, client } = instantiateService();
    const redis = client!;

    redis.quit.mockRejectedValueOnce(new Error('close failed'));

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
