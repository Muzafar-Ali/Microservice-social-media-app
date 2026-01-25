import dotenv from 'dotenv';
dotenv.config();

const config = {
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  serviceName: process.env.SERVICE_NAME || "chat-service"
}

export default config;