import config from '../config/config.js';
import pino from 'pino';
import { trace } from '@opentelemetry/api';

const isProduction = config.environment === 'production';

const traceContextMixin = () => {
  const activeSpan = trace.getActiveSpan();

  if (!activeSpan) {
    return {};
  }

  const spanContext = activeSpan.spanContext();

  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: spanContext.traceFlags,
  };
};

const commonLoggerOptions = {
  mixin: traceContextMixin,
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
};

const createProductionLogger = () =>
  pino({
    ...commonLoggerOptions,
    level: config.logLevel || 'info',
    base: {
      'service.name': config.serviceName || 'media-service',
      'deployment.environment': config.environment || 'production',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });

const createDevelopmentLogger = () =>
  pino({
    ...commonLoggerOptions,
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
