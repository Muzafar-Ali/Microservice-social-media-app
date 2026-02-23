import dotenv from 'dotenv';
dotenv.config();

const config = {
  redisUrl: process.env.REDIS_URL || "redis://redis-cache:6379" || "redis://localhost:6379",
  userServiceUrl: process.env.USER_SERVICE_URL ?? "http://user-service:4001",
  mediaServiceUrl: process.env.MEDIA_SERVICE_URL ?? "http://media-service:4002",
  postServiceLUrl: process.env.POST_SERVICE_URL ?? "http://post-service:4003",
  chatServiceUrl: process.env.CHAT_SERVICE_URL ?? "http://chat-service:4004",
}

export default config