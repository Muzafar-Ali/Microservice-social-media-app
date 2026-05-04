import pino from 'pino';
import config from '../config/config.js';

const isProduction = config.environment === 'production';

const productionLogger = pino({
  level: config.logLevel || 'warn',
  base: {
    service: config.serviceName || 'user-service',
    env: config.environment || 'production',
  },
  timestamp: pino.stdTimeFunctions.isoTime,

  // structured logs
  formatters: {
    level(label) {
      return { level: label };
    },
  },

  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
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
