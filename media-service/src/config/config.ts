import dotenv from 'dotenv';
dotenv.config();

const parseCsvEnv = (value: string | undefined, fallback: string[]): string[] => {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) ?? fallback;
};

const config = {
  port: process.env.PORT,
  environment: process.env.NODE_ENV,
  logLevel: process.env.LOG_LEVEL,
  serviceName: process.env.SERVICE_NAME,
  kafkaBrokers: parseCsvEnv(process.env.KAFKA_BROKERS, ['localhost:9092']),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // cloudinary
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY!,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET!,
  // JWT
  jwtSecret: process.env.JWT_SECRET,
};

export default config;
