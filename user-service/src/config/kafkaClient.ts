import { Kafka } from "kafkajs";
import config from "./config.js";

const kafka = new Kafka({
  clientId: 'user-service',
  brokers: config.kafkaBrokers,
})

export default kafka;