  export const failedLoginAttemptsCacheKey = (identifier: string) => {
    return `auth:login:fail:user:${identifier}`
  }
  
  export const loginLockoutCacheKey = (identifier: string) => {
    return `auth:login:lock:user:${identifier}`;
  }