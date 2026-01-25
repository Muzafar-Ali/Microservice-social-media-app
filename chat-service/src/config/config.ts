import dotenv from 'dotenv';
dotenv.config();

const config = {
  environment: process.env.NODE_ENV || 'development',
}

export default config;