export const USER_CACHE_TTL_SECONDS = 3600;
  
export const userCacheKeyById = (id: number) => {
  return `user:${id}`;
}

export const userCacheKeyByUsername = (username: string) => {
  return `user:username:${username}`;
}