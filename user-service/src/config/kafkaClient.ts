import { Kafka, logLevel } from 'kafkajs';
import config from './config.js';

const kafka = new Kafka({
  clientId: 'user-service',
  brokers: config.kafkaBrokers,
  logLevel: logLevel.INFO,
});

export default kafka;
