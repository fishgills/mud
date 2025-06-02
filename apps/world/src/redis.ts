import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redis.on('error', (err: Error) => {
  console.error('Redis client error:', err);
});

// Connect to Redis
redis.connect().catch(console.error);

export default redis;
