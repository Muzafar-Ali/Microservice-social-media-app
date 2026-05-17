import { redis } from '../config/redisClient.js';
import { redisCacheOperationsTotal } from '../monitoring/metrics.js';
import logger from '../utils/logger.js';

class CacheService {
  async get(key: string): Promise<unknown | null> {
    try {
      const cachedValue = await redis.get(key);

      if (!cachedValue) {
        redisCacheOperationsTotal.inc({ operation: 'read', result: 'miss' });
        return null;
      }

      redisCacheOperationsTotal.inc({ operation: 'read', result: 'hit' });
      return JSON.parse(cachedValue);
    } catch (error) {
      redisCacheOperationsTotal.inc({ operation: 'read', result: 'error' });
      logger.warn({ error, cacheKey: key }, 'Failed to get value from cache');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlInSeconds?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);

      if (ttlInSeconds) {
        await redis.set(key, serializedValue, { EX: ttlInSeconds });
      } else {
        await redis.set(key, serializedValue);
      }

      redisCacheOperationsTotal.inc({ operation: 'write', result: 'success' });
    } catch (error) {
      redisCacheOperationsTotal.inc({ operation: 'write', result: 'error' });
      logger.warn({ error, cacheKey: key }, 'Failed to set value in cache');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
      redisCacheOperationsTotal.inc({ operation: 'delete', result: 'success' });
    } catch (error) {
      redisCacheOperationsTotal.inc({ operation: 'delete', result: 'error' });
      logger.warn({ error, cacheKey: key }, 'Failed to delete cache key');
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      await redis.del(keys);
      redisCacheOperationsTotal.inc({ operation: 'delete', result: 'success' }, keys.length);
    } catch (error) {
      redisCacheOperationsTotal.inc({ operation: 'delete', result: 'error' });
      logger.warn({ error, cacheKeys: keys }, 'Failed to delete cache keys');
    }
  }
}

export const cacheService = new CacheService();
