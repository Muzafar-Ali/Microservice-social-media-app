import { createClient } from 'redis';
import config from './config.js';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  console.error('❌ Redis error in social graph service: ', err.code, err.message);
});

export async function initRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    console.log('✅ Redis connected (social-graph-service)');
  }
}
