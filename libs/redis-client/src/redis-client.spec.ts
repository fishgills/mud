import { redisClient } from './redis-client';

describe('redisClient', () => {
  it('should work', () => {
    expect(redisClient()).toEqual('redis-client');
  });
});
