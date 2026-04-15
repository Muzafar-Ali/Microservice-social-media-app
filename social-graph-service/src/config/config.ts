import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const config = {
  environment: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4005,
  dataBaseUrl: process.env.DATABASE_URL,
  serviceName: process.env.SERVICE_NAME || 'social-graph-service',
  logLevel: process.env.LOG_LEVEL || 'info',
  kafkaBrokers: ['kafka:9092'],
  redisUrl: process.env.REDIS_URL || 'redis://redis-cache:6379',
  // jwtSecret: process.env.JWT_SECRET,
};

export default config;
