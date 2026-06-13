import client from 'prom-client';

export const kafkaMessagesPublishedTotal = new client.Counter({
  name: 'kafka_messages_published_total',
  help: 'Total number of Kafka messages successfully published',
  labelNames: ['topic', 'event_name'],
});

export const kafkaPublishFailuresTotal = new client.Counter({
  name: 'kafka_publish_failures_total',
  help: 'Total number of Kafka publish failures',
  labelNames: ['topic', 'event_name'],
});

export const kafkaMessagesConsumedTotal = new client.Counter({
  name: 'kafka_messages_consumed_total',
  help: 'Total number of Kafka messages consumed',
  labelNames: ['topic', 'event_name'],
});

export const kafkaConsumerFailuresTotal = new client.Counter({
  name: 'kafka_consumer_failures_total',
  help: 'Total number of Kafka consumer processing failures',
  labelNames: ['topic', 'reason'],
});

export const kafkaDlqMessagesTotal = new client.Counter({
  name: 'kafka_dlq_messages_total',
  help: 'Total number of Kafka messages sent to DLQ',
  labelNames: ['source_topic', 'dlq_topic', 'reason'],
});

export const kafkaOffsetCommitFailuresTotal = new client.Counter({
  name: 'kafka_offset_commit_failures_total',
  help: 'Total number of Kafka offset commit failures',
  labelNames: ['topic'],
});

export const registerKafkaMetrics = (register: client.Registry): void => {
  register.registerMetric(kafkaMessagesPublishedTotal);
  register.registerMetric(kafkaPublishFailuresTotal);
  register.registerMetric(kafkaMessagesConsumedTotal);
  register.registerMetric(kafkaConsumerFailuresTotal);
  register.registerMetric(kafkaDlqMessagesTotal);
  register.registerMetric(kafkaOffsetCommitFailuresTotal);
};