import process from 'node:process';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import config from '../config/config.js';

const isTracingEnabled = process.env.OTEL_TRACES_ENABLED !== 'false';

let telemetrySdk: NodeSDK | undefined;

if (isTracingEnabled) {
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://otel-collector:4318/v1/traces',
  });

  telemetrySdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: config.serviceName || 'post-service',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.environment || 'development',
    }),
    spanProcessor: new BatchSpanProcessor(traceExporter, {
      maxQueueSize: Number(process.env.OTEL_BSP_MAX_QUEUE_SIZE || 2048),
      maxExportBatchSize: Number(process.env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE || 512),
      scheduledDelayMillis: Number(process.env.OTEL_BSP_SCHEDULE_DELAY || 5000),
      exportTimeoutMillis: Number(process.env.OTEL_BSP_EXPORT_TIMEOUT || 30000),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) => {
            const requestUrl = request.url ?? '';
            return requestUrl === '/health' || requestUrl === '/ready' || requestUrl === '/metrics';
          },
        },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis': { enabled: true },
        '@opentelemetry/instrumentation-kafkajs': { enabled: true },
        '@opentelemetry/instrumentation-pino': { enabled: true },
      }),
    ],
  });

  telemetrySdk.start();
}

const shutdownTelemetry = async () => {
  try {
    await telemetrySdk?.shutdown();
  } catch (error) {
    console.error('Error shutting down telemetry SDK', error);
  }
};

process.once('SIGTERM', () => {
  void shutdownTelemetry();
});

process.once('SIGINT', () => {
  void shutdownTelemetry();
});
