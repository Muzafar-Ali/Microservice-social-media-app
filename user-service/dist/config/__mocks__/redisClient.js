import { mockDeep } from 'jest-mock-extended';
// We export a deep mock of the redis client.
// jest-mock-extended will handle all the properties and methods.
export const redis = mockDeep();
// We can also mock the initRedis function if needed, here we'll just make it a no-op
export const initRedis = jest.fn(async () => Promise.resolve());
