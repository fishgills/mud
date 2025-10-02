import { CacheService } from './cache.service';

// Mock redis module
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

// Mock env module
jest.mock('../env', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
    CACHE_PREFIX: 'test:',
  },
}));

const mockRedisClient = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scanIterator: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.connect.mockResolvedValue(undefined);
  });

  describe('constructor', () => {
    it('should create service with Redis enabled', () => {
      service = new CacheService();

      expect(service.isEnabled()).toBe(true);
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should register error handler', () => {
      service = new CacheService();

      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
    });
  });

  describe('isEnabled', () => {
    it('should return true when Redis is configured', () => {
      service = new CacheService();

      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      service = new CacheService();
    });

    it('should retrieve cached value', async () => {
      mockRedisClient.get.mockResolvedValue('test-value');

      const result = await service.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('test:test-key');
    });

    it('should return null when key not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('should add prefix to key', async () => {
      mockRedisClient.get.mockResolvedValue('value');

      await service.get('my-key');

      expect(mockRedisClient.get).toHaveBeenCalledWith('test:my-key');
    });
  });

  describe('set', () => {
    beforeEach(() => {
      service = new CacheService();
    });

    it('should set cached value with TTL', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('test-key', 'test-value', 30000);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test:test-key',
        'test-value',
        { PX: 30000 },
      );
    });

    it('should handle different TTL values', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('key1', 'value1', 1000);
      await service.set('key2', 'value2', 60000);

      expect(mockRedisClient.set).toHaveBeenCalledWith('test:key1', 'value1', {
        PX: 1000,
      });
      expect(mockRedisClient.set).toHaveBeenCalledWith('test:key2', 'value2', {
        PX: 60000,
      });
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.set('test-key', 'test-value', 30000),
      ).resolves.not.toThrow();
    });

    it('should add prefix to key', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('my-key', 'my-value', 5000);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'test:my-key',
        'my-value',
        { PX: 5000 },
      );
    });
  });

  describe('clearAll', () => {
    beforeEach(() => {
      service = new CacheService();
    });

    it('should delete all keys with prefix', async () => {
      mockRedisClient.scanIterator.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield 'test:key1';
          yield 'test:key2';
          yield 'test:key3';
        },
      });
      mockRedisClient.del.mockResolvedValue(3);

      const result = await service.clearAll();

      expect(result).toBe(3);
      expect(mockRedisClient.scanIterator).toHaveBeenCalledWith({
        MATCH: 'test:*',
        COUNT: 1000,
      });
    });

    it('should handle empty cache', async () => {
      mockRedisClient.scanIterator.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          // No keys
        },
      });

      const result = await service.clearAll();

      expect(result).toBe(0);
    });

    it('should handle scan errors gracefully', async () => {
      mockRedisClient.scanIterator.mockImplementation(() => {
        throw new Error('Scan error');
      });

      const result = await service.clearAll();

      expect(result).toBe(0);
    });
  });

  describe('clearPattern', () => {
    beforeEach(() => {
      service = new CacheService();
    });

    it('should delete keys matching pattern', async () => {
      mockRedisClient.scanIterator.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield 'test:user:123';
          yield 'test:user:456';
        },
      });
      mockRedisClient.del.mockResolvedValue(2);

      const result = await service.clearPattern('user:*');

      expect(result).toBe(2);
      expect(mockRedisClient.scanIterator).toHaveBeenCalledWith({
        MATCH: 'test:user:*',
        COUNT: 1000,
      });
    });

    it('should handle empty pattern', async () => {
      mockRedisClient.scanIterator.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          yield 'test:key1';
        },
      });
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.clearPattern('');

      expect(result).toBe(1);
      expect(mockRedisClient.scanIterator).toHaveBeenCalledWith({
        MATCH: 'test:*',
        COUNT: 1000,
      });
    });

    it('should batch delete operations', async () => {
      const keys: string[] = [];
      for (let i = 0; i < 600; i++) {
        keys.push(`test:key${i}`);
      }

      mockRedisClient.scanIterator.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const key of keys) {
            yield key;
          }
        },
      });
      mockRedisClient.del
        .mockResolvedValue(500)
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(100);

      await service.clearPattern('*');

      // Should batch at 500 keys
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);
    });

    it('should handle delete errors gracefully', async () => {
      const keys: string[] = [];
      for (let i = 0; i < 501; i++) {
        keys.push(`test:key${i}`);
      }

      mockRedisClient.scanIterator.mockReturnValue({
        [Symbol.asyncIterator]: async function* () {
          for (const key of keys) {
            yield key;
          }
        },
      });
      mockRedisClient.del.mockRejectedValue(new Error('Delete error'));

      const result = await service.clearPattern('*');

      expect(result).toBe(0);
    });
  });

  describe('onModuleDestroy', () => {
    it('should quit Redis client on destroy', async () => {
      service = new CacheService();

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle quit errors gracefully', async () => {
      service = new CacheService();
      mockRedisClient.quit.mockRejectedValue(new Error('Quit error'));

      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
