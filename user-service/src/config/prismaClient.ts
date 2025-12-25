import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import config from './config.js';

// 1. Get the connection string from env (docker/local both use DATABASE_URL)
const connectionString = process.env.DATABASE_URL ?? config.dataBaseUrl;

// 2. Create the adapter
const adapter = new PrismaPg({ connectionString });

// 3. Instantiate PrismaClient with the adapter
const prisma = new PrismaClient({
  adapter,
  // log: config.environment === 'development' ? ['query', 'info', 'warn'] : ['error'],
});

// 4. Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
