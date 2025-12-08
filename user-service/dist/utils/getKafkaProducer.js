import kafka from "../config/kafkaClient.js";
let producer = null;
export const getKafkaProducer = async () => {
    if (!producer) {
        producer = kafka.producer();
        await producer.connect();
        console.log('[Kafka] Producer connected (user-service)');
    }
    return producer;
};
