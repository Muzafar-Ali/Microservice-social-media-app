import config from '../config/config.js';
import pino from 'pino';

const isProduction = config.environment === 'production';

const productionLogger = pino({
  level: config.logLevel || 'info',
  base: {
    service: config.serviceName || 'media-service',
    env: config.environment,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: [
    'req.headers.authorization',
    '*.password',
    '*.token',
    '*.accessToken',
    '*.refreshToken',
    '*.apiKey',
    '*.secret',
  ],
});

const developmentLogger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:dd-mm-yyyy HH:MM:ss',
      ignore: 'pid,hostname',
    },
  },
});

const logger = isProduction ? productionLogger : developmentLogger;

export default logger;
