import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const parseCsvEnv = (value: string | undefined, fallback: string[]): string[] => {
  return (
    value
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) ?? fallback
  );
};

const parsePositiveIntEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const config = {
  environment: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4003,
  dataBaseUrl: process.env.DATABASE_URL,
  serviceName: process.env.SERVICE_NAME || 'post-service',
  logLevel: process.env.LOG_LEVEL || 'info',
  // kafkaBrokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ["localhost:9092"],
  kafkaBrokers: ['kafka-1:9092', 'kafka-2:9092', 'kafka-3:9092'],
  jwtSecret: process.env.JWT_SECRET,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsAllowedOrigins: parseCsvEnv(process.env.CORS_ALLOWED_ORIGINS, ['http://localhost:3000']),
  postRateLimits: {
    feed: {
      windowSeconds: parsePositiveIntEnv(process.env.POST_FEED_RATE_LIMIT_WINDOW_SECONDS, 60),
      maxRequests: parsePositiveIntEnv(process.env.POST_FEED_RATE_LIMIT_MAX_REQUESTS, 180),
    },
    write: {
      windowSeconds: parsePositiveIntEnv(process.env.POST_WRITE_RATE_LIMIT_WINDOW_SECONDS, 60),
      maxRequests: parsePositiveIntEnv(process.env.POST_WRITE_RATE_LIMIT_MAX_REQUESTS, 30),
    },
    engagement: {
      windowSeconds: parsePositiveIntEnv(process.env.POST_ENGAGEMENT_RATE_LIMIT_WINDOW_SECONDS, 60),
      maxRequests: parsePositiveIntEnv(process.env.POST_ENGAGEMENT_RATE_LIMIT_MAX_REQUESTS, 120),
    },
  },
};

export default config;
