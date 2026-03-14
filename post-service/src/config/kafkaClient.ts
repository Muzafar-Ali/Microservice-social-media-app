import { Kafka, logLevel } from "kafkajs";
import config from "./config.js";

const kafka = new Kafka({
  clientId: 'post-service',
  brokers: config.kafkaBrokers,
  logLevel: logLevel.ERROR
});

export default kafka;
