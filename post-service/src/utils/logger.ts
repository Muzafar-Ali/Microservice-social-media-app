import pino from 'pino';
import config from '../config/config.js';

const isProduction = config.environment === 'production';

const createProductionLogger = () =>
  pino({
    level: config.logLevel || 'info',
    base: { service: config.serviceName || 'post-service' },
    redact: ['req.headers.authorization'],
  });

const createDevelopmentLogger = () =>
  pino({
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

const logger = isProduction ? createProductionLogger() : createDevelopmentLogger();

export default logger;
