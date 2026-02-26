import dotenv from 'dotenv';
dotenv.config();

const config = {
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  serviceName: process.env.SERVICE_NAME || "chat-service",
  port: Number(process.env.PORT || 4004),
  jwtSecret: process.env.JWT_SECRET,
  dataBaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || "redis://redis-cache:6379" || "redis://localhost:6379",
}

export default config;