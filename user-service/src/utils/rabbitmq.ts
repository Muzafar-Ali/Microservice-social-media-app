// import amqp, { Channel, Connection } from 'amqplib';
// import config from '../config/config.js';

// let channel: Channel | null = null;

// export const connectRabbitMQ = async () => {
//   if (channel) {
//     return {  channel };
//   }

//   try {
//     const connection = await amqp.connect(config.rabbitmqUrl);
//     channel = await connection.createChannel();
//     console.log("✅ RabbitMQ connected (user-service)");

//     return { channel, connection };
    
//   } catch (error) {
//     console.error("Error connecting to RabbitMQ:", error);
//     throw error;
//   }
// };

// export const publishUserEvent = async<T> (routingKey: string, payload: T) => {
  
//   if (!channel) throw new Error("RabbitMQ channel not initialized");

//   const exchange = "user.events"; // topic exchange name for user-service
//   await channel.assertExchange(exchange, "topic", { durable: true });

//   const messageBuffer = Buffer.from(JSON.stringify(payload));

//   channel.publish(exchange, routingKey, messageBuffer, {
//     contentType: "application/json",
//     persistent: true,
//   });
// }


// import { connect, Channel } from "amqplib";

// let channel: Channel | null = null;

// export const connectRabbitMQ = async (): Promise<{ channel: Channel }> => {
//   if (channel) {
//     return { channel };
//   }

//   const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost";
//   const connection = await connect(RABBITMQ_URL);

//   channel = await connection.createChannel();
//   console.log("✅ RabbitMQ connected (user-service)");

//   // Optionally: connection.on("close", () => { channel = null; });
//   // so you can auto-reconnect later

//   return { channel };
// };

// connection.on("close", () => {
//   channel = null; // next call to connectRabbitMQ will reconnect
// });
