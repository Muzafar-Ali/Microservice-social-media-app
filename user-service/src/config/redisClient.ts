import { createClient } from 'redis';
import config from './config.js';
import logger from '../utils/logger.js';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  logger.error('❌ Redis error in user-service: ', err.code, err.message);
});

export async function initRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    logger.info('✅ Redis connected (user-service)');
  }
}
