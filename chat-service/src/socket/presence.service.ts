import { redis } from "../config/redisClient.js";

type PresenceUpdate = {
  userId: string;
  online: boolean;
  lastSeen?: string; // ISO string
};

const ONLINE_SET_KEY = "presence:onlineUsers";
const USER_SOCKETS_KEY = (userId: string) => `presence:user:${userId}:sockets`;
const LAST_SEEN_KEY = (userId: string) => `presence:lastSeen:${userId}`;

/**
 * Presence design (simple + production-friendly):
 * - Keep a SET for online users
 * - Keep a SET of sockets per user (multi-tab supported)
 * - Keep lastSeen timestamp in Redis (TTL so it doesn't grow forever)
 */
export class PresenceService {
  
  async markOnline(userId: string, socketId: string): Promise<PresenceUpdate> {
    await redis.sAdd(ONLINE_SET_KEY, userId),
    await redis.sAdd(USER_SOCKETS_KEY(userId), socketId)
    
    // When online, we can clear lastSeen or just keep it as last known.
    // We'll keep it, but you can choose to delete it.
    return { userId, online: true };
  }

  async markOfflineIfLastSocket(userId: string, socketId: string): Promise<PresenceUpdate | null> {
    // remove this socket
    await redis.sRem(USER_SOCKETS_KEY(userId), socketId);

    // check remaining sockets
    const remainingSockets = await redis.sCard(USER_SOCKETS_KEY(userId));
    if (remainingSockets > 0) {
      return null; // still online somewhere else
    }

    // mark offline
    await redis.sRem(ONLINE_SET_KEY, userId);

    const lastSeenIso = new Date().toISOString();
    await redis.set(LAST_SEEN_KEY(userId), lastSeenIso, { EX: 60 * 60 * 24 * 30 }); // 30 days

    return { userId, online: false, lastSeen: lastSeenIso };
  }

  async getLastSeen(userId: string): Promise<string | null> {
    return redis.get(LAST_SEEN_KEY(userId));
  }

  async isOnline(userId: string): Promise<boolean> {
    const isMember = await redis.sIsMember(ONLINE_SET_KEY, userId);
    return isMember === 1;
  }

}