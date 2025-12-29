export const USER_CACHE_TTL_SECONDS = 3600;
  
export const getUserCacheKeyById = (id: number) => {
  return `user:${id}`;
}

export const getUserCacheKeyByUsername = (username: string) => {
  return `user:username:${username}`;
}