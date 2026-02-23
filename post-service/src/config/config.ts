import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const config = {
  environment: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4002,
  dataBaseUrl: process.env.DATABASE_URL,
  serviceName: process.env.SERVICE_NAME || 'post-service',
  logLevel: process.env.LOG_LEVEL || 'info',
  // kafkaBrokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ["localhost:9092"],
  kafkaBrokers: ["kafka:9092"],
  jwtSecret: process.env.JWT_SECRET,
  redisUrl: process.env.REDIS_URL || "redis://redis-cache:6379" || "redis://localhost:6379"
};

export default config;
