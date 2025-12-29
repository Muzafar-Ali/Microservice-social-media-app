import { Kafka } from "kafkajs";
import config from "./config.js";

const kafka = new Kafka({
  clientId: 'post-service',
  brokers: config.kafkaBrokers,
});

export default kafka;
