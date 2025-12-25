import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const config = {
  environment: process.env.NODE_ENV, 
  port: process.env.PORT || 4001,
  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiry: "1hour",
  saltRounds: Number(process.env.SALT_ROUNDS),
  dataBaseUrl: process.env.DATABASE_URL,
  // pino logging
  serviceName: process.env.SERVICE_NAME,
  logLevel: process.env.LOG_LEVEL,
  db: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
  },
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  kafkaBrokers: ["kafka:9092"],
  // kafkaBrokers: ['localhost:9092']
  // rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://localhost:5672"
  // rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://localhost",
};

if (!config.jwtSecret) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

export default config;