import pino from 'pino';
import { trace } from '@opentelemetry/api';

const logger = pino({
  mixin() {
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
  },
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    'service.name': 'web-gateway',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
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

export default logger;
