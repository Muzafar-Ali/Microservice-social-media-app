import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RedisClientType, createClient } from 'redis';

// Get the type of the redis instance, without actually creating a client
type RedisClient = ReturnType<typeof createClient>;

// We export a deep mock of the redis client.
// jest-mock-extended will handle all the properties and methods.
export const redis: DeepMockProxy<RedisClient> = mockDeep<RedisClient>();

// We can also mock the initRedis function if needed, here we'll just make it a no-op
export const initRedis = jest.fn(async () => Promise.resolve());
