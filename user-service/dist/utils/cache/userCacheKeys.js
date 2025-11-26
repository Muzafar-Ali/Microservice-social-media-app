export const USER_CACHE_TTL_SECONDS = 3600;
export const userCacheKeyById = (id) => {
    return `user:${id}`;
};
export const userCacheKeyByUsername = (username) => {
    return `user:username:${username}`;
};
