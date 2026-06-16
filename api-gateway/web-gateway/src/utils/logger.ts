import pino from 'pino';

const logger = pino({
  name: 'web-gateway',
  level: process.env.LOG_LEVEL ?? 'info',
});

export default logger;
