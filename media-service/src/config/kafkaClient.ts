import { Kafka } from "kafkajs";
import config from "./config";

const kafka = new Kafka({
  clientId: "media-service",
  brokers: config.kafkaBrokers
})

export default kafka;